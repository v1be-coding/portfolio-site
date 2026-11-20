# Where should episode 0's portfolio site live: apex, www or a subdomain?

_emilianocasijr.com on Cloudflare (proxied, SSL Full strict) in front of CloudFront + ACM, Terraform cloudflare provider 5.28.1 · researched 2026-11-16_

## TL;DR

- **No primary source says apex, www or a subdomain ranks or works better.** Google's rule is: pick one host, 301 the others to it, and link to it consistently.
- **For a portfolio, the evidence leans to the apex as the hub,** with each project on its own subdomain. That is the most common pattern in practitioner write-ups, and it matches the series layout (`ulam.emilianocasijr.com` and so on). `portfolio.` has no support anywhere.
- **The classic arguments for www don't apply here.**
  - CNAME at the apex: Cloudflare flattens proxied records automatically.
  - Cookies leaking to subdomains: the template sets no cookies, and host-only cookies avoid the leak anyway.
- **The cost of the apex is a small infra change.** The infra hardcodes `<subdomain>.<zone>`. A `www` redirect needs a proxied placeholder record and a Redirect Rule. Most of the rest is already in place: SSL is Full (strict), the CloudFront alias is the hostname, and DNS records use full names with trailing dots trimmed.
- **Biggest gotcha:** don't write `name = "@"` in `cloudflare_dns_record`. Use the full zone name, or Terraform shows a diff on every plan (provider issues #5440 and #7289).

## Documented / recommended

### DNS at the apex

- A CNAME can't share a node with other data, and the apex always has SOA and NS records. So a plain CNAME can't go at the apex. — [RFC 1034 §3.6.2](https://www.rfc-editor.org/rfc/rfc1034), [RFC 1912 §2.4](https://www.rfc-editor.org/rfc/rfc1912)
- Cloudflare flattens a CNAME at `@` by default on all plans, and always flattens proxied records, because they answer with Cloudflare's IPs. — [Set up CNAME flattening](https://developers.cloudflare.com/dns/cname-flattening/set-up-cname-flattening/), [CNAME flattening](https://developers.cloudflare.com/dns/cname-flattening/)
- Cloudflare's own example of an apex record is a proxied record at `@`. — [Create zone apex record](https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-zone-apex/)

### CloudFront and ACM

- The apex can be a CloudFront alternate domain name. The certificate must list the apex itself, because `*.example.com` doesn't cover it. — [CloudFront: alternate domain names](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/CNAMEs.html)
- CloudFront returns a 403 when the Host header isn't one of the distribution's alternate domain names. Cloudflare passes the visitor's hostname through, so the apex must be on the distribution. — [AWS: troubleshoot CloudFront 403](https://repost.aws/knowledge-center/cloudfront-troubleshoot-403-errors)
- With Flexible SSL, an origin that redirects HTTP to HTTPS sends the browser into a loop. Use Full or Full (strict). — [Cloudflare: too many redirects](https://developers.cloudflare.com/ssl/troubleshooting/too-many-redirects/)

### Choosing the canonical host

- Pick one canonical URL and redirect the other variants to it with a permanent server-side redirect. Link to it consistently. — [Google: consolidate duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- Google retired the preferred-domain setting, and no Google source says www or non-www ranks better. Google picks the canonical from your signals. — [Google blog, 2019-06-18](https://developers.google.com/search/blog/2019/06/bye-bye-preferred-domain-setting)

### Redirecting www to the apex

- Use a Redirect Rule: match `https://www.*`, target `https://${1}`, status 301, keep the query string. — [Cloudflare: redirect www to root](https://developers.cloudflare.com/rules/url-forwarding/examples/redirect-www-to-root/)
- Rules only run on proxied traffic. A redirect-only host needs a proxied placeholder record, AAAA `100::` or A `192.0.2.1`. — [Single Redirects](https://developers.cloudflare.com/rules/url-forwarding/single-redirects/create-dashboard/), [Create DNS records](https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/), [Redirect a domain](https://developers.cloudflare.com/fundamentals/manage-domains/redirect-domain/), [Pages: www redirect](https://developers.cloudflare.com/pages/how-to/www-redirect/)

### Portfolio-specific: a hub domain with apps on sibling subdomains

- **Cookies:** a cookie without `Domain` is host-only. `Domain=emilianocasijr.com` sends it to every subdomain. Any subdomain can set a parent-domain cookie that its siblings receive. — [RFC 6265 §4.1.2.3, §8.6](https://www.rfc-editor.org/rfc/rfc6265)
- **HSTS:** `includeSubDomains` on the apex binds every app subdomain. A subdomain can't set policy for its parent. Preloading requires `includeSubDomains` and covers every subdomain. — [RFC 6797](https://www.rfc-editor.org/rfc/rfc6797), [hstspreload.org](https://hstspreload.org/)
- **Search:** Google generally treats subdomains as part of the root domain for site diversity. Site names and favicons are set per hostname, so each app subdomain can have its own. — [Ranking systems guide](https://developers.google.com/search/docs/appearance/ranking-systems-guide), [Site names](https://developers.google.com/search/docs/appearance/site-names), [Favicon](https://developers.google.com/search/docs/appearance/favicon-in-search)
- **Email:** MX records and their targets are always DNS-only, and flattening can break CNAME-based DKIM or autodiscover records. — [Cloudflare: email issues](https://developers.cloudflare.com/dns/troubleshooting/email-issues/)

## Field reports

### Named authors mostly prefer www, for cookies and DNS flexibility — Strong pattern (5 reporters)

The reasons given: apex cookies reach every subdomain, an apex A record is hard to move, and an apex ALIAS record lost geo-routing (one author measured TTFB fall from 275ms to 73ms after moving to www, on NS1). Two of these authors say Cloudflare's CNAME flattening doesn't have the DNS problem. No named author makes a strong case for the bare domain; it is only argued as "shorter and cleaner" in SEO and vendor pieces. Most of these posts are from 2013–2020, before flattening was common.
Sources: [Johansen 2017](https://bjornjohansen.com/www-or-not), [Peterson 2013](https://blog.ndpsoftware.com/2013/09/why-not-naked-root-apex-domains.html), [Matsuyama 2020](https://dev.to/craftzdog/you-should-not-use-apex-domain-with-alias-record-160e), [jvt.me 2019](https://jvt.me/posts/2019/05/26/why-wwwjvtme), [Xebia 2017](https://xebia.com/blog/caveats-and-pitfalls-of-cookie-domains/)

### The portfolio as a hub, each project on its own subdomain — Strong pattern (3 reporters)

The main site works as the "portal". Each project gets a subdomain, so it can use its own stack and grow on its own. One HN thread adds that paths under a personal site read as portfolio pieces, and subdomains suit projects that might grow. One of these authors keeps their hub on www and doesn't say why.
Sources: [Chiang 2019](https://dev.to/chiangs/host-your-projects-on-subdomains-59m3), [Lewington, freeCodeCamp](https://www.freecodecamp.org/news/how-to-host-a-git-repository-on-a-subdomain-with-netlify-b8afb5fca96e), [jottings](https://jottings-me-landing.pages.dev/blog/subdomain-vs-root.html), [HN 20710000](https://news.ycombinator.com/item?id=20710000)

### Proxied Cloudflare in front of CloudFront returns 403 until the hostname is an alternate domain name — Strong pattern (2 forum reporters plus AWS docs)

The fix is to add the public hostname as an alternate domain name and attach a matching ACM certificate. Separately, moving SSL mode from Flexible to Full (strict) fixed a 403 or a redirect loop. One blog recommends leaving the record DNS-only, not proxied, saying proxying adds little in front of CloudFront; it names no concrete failure. One author who proxied it needed Full (strict) and a Host header that CloudFront knows.
Sources: [CF Community 90304](https://community.cloudflare.com/t/getting-403-error-when-acessing-cloudfront-alias-solved/90304), [CF Community 192044](https://community.cloudflare.com/t/proxy-request-to-aws-cloudfront/192044), [Sallai 2020](https://advancedweb.hu/how-to-use-a-custom-domain-on-cloudfront-with-cloudflare-managed-dns/), [Kiser 2025](https://cynthiakiser.com/blog/2025/11/18/cloudflare-and-s3.html)

### `cloudflare_dns_record` with `name = "@"` drifts — Strong pattern (3 issues; maintainer says it's intended)

v5 expects the full domain name. `"@"` or a short label is accepted, but a refresh rewrites it, so every plan shows an update. Anything that reads `.name` also changes between runs. Issue #7289 (2026-08) is still open.
Sources: [#5440](https://github.com/cloudflare/terraform-provider-cloudflare/issues/5440), [#5498](https://github.com/cloudflare/terraform-provider-cloudflare/issues/5498), [#7289](https://github.com/cloudflare/terraform-provider-cloudflare/issues/7289), [#5517](https://github.com/cloudflare/terraform-provider-cloudflare/issues/5517)

### A CNAME `content` ending in "." drifts — fixed in v5.29.0 (2026-11-11)

This hits ACM validation values. The repo already strips the dot with `trimsuffix`, and the pinned provider is 5.28.1, so nothing changes for us.
Sources: [#7286](https://github.com/cloudflare/terraform-provider-cloudflare/issues/7286)

### A grey-cloud (DNS-only) www record never runs the Redirect Rule — Strong pattern (3+ sources, matches the docs)

Sources: [Cloudflare Pages docs](https://developers.cloudflare.com/pages/how-to/www-redirect/), [onticdani](https://dev.to/onticdani/how-to-properly-redirect-www-to-non-www-with-cloudflare-2865), a 2025 r/CloudFlare comment

### Personal domain on a résumé gets few clicks — Anecdote (1)

[Tildes](https://tildes.net/~life/10se)

## Official vs reality

- **Official sources:** the apex works through Cloudflare flattening and CloudFront takes the apex as an alias. **Named authors:** they still prefer www, but mostly for reasons from before flattening or for cookie reasons. Status: contested, and only the cookie argument still applies. It is manageable with host-only cookies.
- **Cloudflare docs:** proxying in front of any origin is supported. **One blog:** leave CloudFront records grey-cloud. Status: undocumented. This infra already proxies every episode, because of the origin header and rate limit, and it works.

## Applied to this repo (v1be-infra `origin/main`)

What already handles an apex:

- `cloudflare_zone_setting.ssl = "strict"`.
- The CloudFront `aliases = [var.hostname]`.
- `cloudflare_dns_record.site` uses `name = var.hostname`, the full name, not `"@"`.
- Validation values are trimmed of their trailing dot.
- The template sets no cookies and no HSTS header.

What an apex would need:

1. **Hostnames:** allow an empty subdomain in `stacks/episodes/main.tf`, where the `hostname` lines read `"${subdomain}.${zone}"`, and in `stacks/org/github.tf` (`SITE_URL`). An empty subdomain would otherwise give `.emilianocasijr.com`.
2. **`www` redirect:** a proxied placeholder `www` record and a 301 Redirect Rule to the apex. They could live in the episode module behind a flag, or in the edge stack, which already owns the zone rulesets. Cloudflare answers the redirect itself, so `www` needs no CloudFront alias or ACM name. That last point is an inference; it is consistent with the docs above.
3. **Email:** before going live, check MX and any DKIM records on the apex with `dig`. No doc confirms that MX coexists with a flattened apex CNAME; that is an inference.

The cheapest choice, with no infra change, is `subdomain = "www"`, possibly with an apex→www redirect later. The cost is that `www` is the canonical URL on the portfolio for good.

## Gaps

- No source compares apex, www and a project subdomain for SEO, beyond "pick one and redirect".
- No first-hand source covers what recruiters type, or whether the apex reads better than www on a résumé.
- No source covers this exact setup end to end: proxied apex, Full (strict), Terraform, CloudFront.
- The Cloudflare Community threads were blocked by a bot check, so their content comes from search snippets and their dates are estimates.
- The picture is lopsided: older pro-www posts outnumber any bare-domain defence, which mostly appears in unattributed SEO content.
