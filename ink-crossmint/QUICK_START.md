# 🚀 Quick Start - Create dWallet & Deploy to Monad

## 1️⃣ Create Ika dWallet (Browser)

```bash
node scripts/create-ika-dwallet.mjs
```

Follow the interactive prompts:
- Opens Ika Dashboard
- Completes DKG ceremony
- Extracts dWallet ID, Cap ID, EVM Address
- Saves to `.env.local`

## 2️⃣ Deploy InkPassReceipt to Monad

```bash
node scripts/setup-complete-flow.mjs
```

Choose deployment method:
- **Remix** (easiest): https://remix.ethereum.org
- **Hardhat** (advanced)

Once deployed, saves contract address to `.env.local`

## 3️⃣ Test Complete Mint Flow

```bash
npm run dev
# Go to: http://localhost:3001/mint
# Connect wallet → Mint NFT
```

Expected flow:
- ✅ Pay 1.5 SUI on Sui testnet
- ✅ Request Ika MPC signature
- ✅ Submit to Monad testnet
- ✅ NFT minted!

---

## 📋 Checklist

- [ ] Run: `node scripts/create-ika-dwallet.mjs`
- [ ] Create dWallet at https://testnet.ika.xyz/dashboard
- [ ] Run: `node scripts/setup-complete-flow.mjs`
- [ ] Deploy to Monad via Remix
- [ ] Run: `npm run dev`
- [ ] Test mint at `/mint` page

---

## 🔗 Links

- **Ika Dashboard**: https://testnet.ika.xyz/dashboard
- **Remix IDE**: https://remix.ethereum.org
- **Sui Explorer**: https://testnet.suivision.xyz
- **Monad Explorer**: https://testnet-explorer.monad.xyz
