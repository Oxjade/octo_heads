# TODO - Fix link preview for octo.useink.xyz

- [x] Inspect Next.js metadata implementation in `ink-crossmint/app/layout.tsx`
- [x] Update metadata `metadataBase` to prefer deployed origin using env vars with fallback to `octo.useink.xyz`
- [x] Remove hardcoded `useink.xyz` references in header/footer links
- [ ] Verify OpenGraph/Twitter tags in built output (`next build`) and spot-check `/` preview fetch
- [ ] Run `npm run lint` and `npm run build` to ensure no TS/Next errors

