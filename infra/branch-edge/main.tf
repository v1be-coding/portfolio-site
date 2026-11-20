# A branch environment's own edge. It serves from the raw cloudfront.net address,
# with no Cloudflare and no header check (ADR-0010), and otherwise routes the same
# way as production's distribution in v1be-infra.

data "aws_cloudfront_cache_policy" "optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_cache_policy" "disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_origin_request_policy" "api" {
  name = "Managed-AllViewerExceptHostHeader"
}

# Clean URLs for prerendered pages, where each page is a folder's index.html.
# v1be-infra owns this shared function (production's copy also checks for
# Cloudflare, which a branch environment can't pass, ADR-0010). CI may only
# read and attach it.
#   /about/   -> 301 to /about, with the query string kept
#   /about    -> /about/index.html, read from the bucket
#   /app.js   -> unchanged, because the last segment has a dot
data "aws_cloudfront_function" "pages" {
  name  = "v1be-pages"
  stage = "LIVE"
}

# Production's own headers policy, which v1be-infra creates for each `pages`
# episode as v1be-<episode>-headers, so a branch environment is judged on exactly
# the headers production sends. CI's role may read and attach it but not create
# headers policies.
data "aws_cloudfront_response_headers_policy" "security" {
  name = var.headers_policy
}

resource "aws_s3_bucket" "site" {
  bucket        = var.bucket
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "site" {
  bucket = aws_s3_bucket.site.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

data "aws_iam_policy_document" "site" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.site.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.site.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id
  policy = data.aws_iam_policy_document.site.json
}

resource "aws_cloudfront_distribution" "site" {
  enabled             = true
  comment             = var.comment
  default_root_object = "index.html"
  http_version        = "http2and3"
  is_ipv6_enabled     = true
  price_class         = "PriceClass_200"

  origin {
    origin_id                = "site"
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_access_control_id = var.origin_access_control_id
  }

  origin {
    origin_id   = "api"
    domain_name = replace(var.api_endpoint, "https://", "")

    # CloudFront replaces any value a caller sends with this one.
    custom_header {
      name  = "x-v1be-api-origin"
      value = var.api_origin_secret
    }

    # The API runs in one region, far from many edges. With the default 5-second
    # keep-alive, an edge's origin connections close between a sender's calls, and
    # each reopened one costs two extra round trips to the origin (about 440 ms
    # from US edges). 60 seconds is the most CloudFront allows without a quota raise.
    custom_origin_config {
      http_port                = 80
      https_port               = 443
      origin_protocol_policy   = "https-only"
      origin_ssl_protocols     = ["TLSv1.2"]
      origin_keepalive_timeout = 60
    }
  }

  default_cache_behavior {
    target_origin_id           = "site"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    cache_policy_id            = data.aws_cloudfront_cache_policy.optimized.id
    response_headers_policy_id = data.aws_cloudfront_response_headers_policy.security.id
    compress                   = true

    function_association {
      event_type   = "viewer-request"
      function_arn = data.aws_cloudfront_function.pages.arn
    }
  }

  ordered_cache_behavior {
    path_pattern               = "/api/*"
    target_origin_id           = "api"
    viewer_protocol_policy     = "https-only"
    allowed_methods            = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods             = ["GET", "HEAD"]
    cache_policy_id            = data.aws_cloudfront_cache_policy.disabled.id
    origin_request_policy_id   = data.aws_cloudfront_origin_request_policy.api.id
    response_headers_policy_id = data.aws_cloudfront_response_headers_policy.security.id
    compress                   = true
  }

  # A missing page is a 403 from the private bucket: CloudFront may only
  # s3:GetObject, so S3 never says 404. As in production, only 403 maps to the
  # 404 page, because the mapping covers the whole distribution and a mapped 404
  # hid the API's JSON 404s. The page keeps its no-cache metadata, and the TTL is
  # short so a page that a later deploy adds isn't hidden behind a cached 404.
  dynamic "custom_error_response" {
    for_each = [403]

    content {
      error_code            = custom_error_response.value
      response_code         = 404
      response_page_path    = "/404.html"
      error_caching_min_ttl = 10
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}
