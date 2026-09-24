## What & why
<!-- One or two sentences. -->

## How it was tested
- [ ] `npm test` passes
- [ ] `npm run test:e2e` passes (desktop + mobile)
- [ ] Checked on the Cloudflare preview URL

## Security checklist
- [ ] No user JSON is sent over the network
- [ ] Advertiser/admin-supplied text is rendered with `textContent` or escaped, never `innerHTML`
- [ ] New API input is validated server-side
- [ ] No secrets committed (CodeRabbit's gitleaks check is green)
