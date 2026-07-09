# 🚀 Ika dWallet + Monad Mint - Quick Setup

## Current Status ✅

```
Active Address: 0xaf19c438c96320d14954a63c06d71fab99a2165800c839d667bd1803ecf86f36
IKA Coin: 0x7b973ebb7576d7bb0c47cc9e9e84af7d024cde7ca99d67b1f5d7ca754556 9f1d
dWallet: ❌ Need to create
Monad Contract: ❌ Need to deploy
```

---

## 📝 Setup Checklist

### ✅ Step 1: Create Ika dWallet (5 min)

- [ ] Open: https://testnet.ika.xyz/dashboard
- [ ] Connect wallet: `nostalgic-carnelian` (0xaf19c43...)
- [ ] Create dWallet
- [ ] Complete DKG ceremony
- [ ] Copy these values:
  ```
  NEXT_PUBLIC_IKA_DWALLET_ID=0x...
  NEXT_PUBLIC_IKA_DWALLET_CAP_ID=0x...
  NEXT_PUBLIC_IKA_DWALLET_EVM_ADDRESS=0x...
  ```

**To verify dWallet creation:**
```bash
# Check on Ika testnet explorer
# Should see dWallet object & cap in your address
```

---

### ✅ Step 2: Deploy InkPassReceipt to Monad (10 min)

#### **Option A: Remix IDE (Easiest)** ⭐

1. Open: https://remix.ethereum.org
2. Create new file: `InkPassReceipt.sol`
3. Copy entire code from: [contracts/monad/InkPassReceipt.sol](../contracts/monad/InkPassReceipt.sol)
4. Left sidebar → Solidity Compiler → Compile `InkPassReceipt.sol`
5. Left sidebar → Deploy & Run Transactions
6. Environment: Select `Injected Provider - MetaMask`
7. MetaMask: Switch to **Monad Testnet** (Chain 10143)
   - If not visible: Add network manually
   - RPC: `https://testnet-rpc.monad.xyz/`
   - Chain ID: `10143`
8. Constructor argument (ika Minter):
   ```
   0x...  (your NEXT_PUBLIC_IKA_DWALLET_EVM_ADDRESS)
   ```
9. Click **Deploy**
10. Approve transaction in MetaMask
11. Wait for confirmation
12. Copy deployed address

#### **Option B: Hardhat** (Advanced)

```bash
npm install --save-dev hardhat @nomicfoundation/hardhat-ethers ethers
npx hardhat init

# Update hardhat.config.js with Monad testnet
# Create scripts/deploy.js
npx hardhat run scripts/deploy.js --network monad
```

---

### ✅ Step 3: Update .env.local

Edit `.env.local` and add:

```env
# From dWallet creation (Step 1)
NEXT_PUBLIC_IKA_DWALLET_ID=0x...
NEXT_PUBLIC_IKA_DWALLET_CAP_ID=0x...
NEXT_PUBLIC_IKA_DWALLET_EVM_ADDRESS=0x...

# From contract deployment (Step 2)
NEXT_PUBLIC_MONAD_RECEIPT_CONTRACT=0x...

# Sui Package & Collection (if you haven't set these)
NEXT_PUBLIC_SUI_PACKAGE_ID=0x...
NEXT_PUBLIC_SUI_COLLECTION_ID=0x...
```

**Verify all 5 required vars are set:**
```bash
grep -E "DWALLET_ID|DWALLET_CAP|DWALLET_EVM|MONAD_RECEIPT" .env.local
```

---

## 🧪 Test Mint Flow

### 1. Start Dev Server
```bash
npm run dev
```
Server runs at: http://localhost:3001

### 2. Navigate to Mint Page
```
http://localhost:3001/mint
```

### 3. Connect Wallet
- Click "Connect Wallet"
- Select `nostalgic-carnelian` (0xaf19c43...)

### 4. Mint NFT
- Click "Mint NFT"
- You'll see:
  - ✅ Pay 1.5 SUI on Sui testnet
  - ✅ Approve Ika MPC signature request
  - ✅ Submitting tx to Monad testnet
  - ✅ NFT minted!

### 5. Verify Mint
- Monad Explorer: https://testnet-explorer.monad.xyz/
- Search for your contract address
- Look for `InkGenesisPassMinted` event

---

## 📊 Monitoring & Debug

### Check Transaction Status
```bash
# Sui testnet
https://testnet.suivision.xyz/address/0xaf19c438c96320d14954a63c06d71fab99a2165800c839d667bd1803ecf86f36

# Monad testnet
https://testnet-explorer.monad.xyz/address/<NEXT_PUBLIC_MONAD_RECEIPT_CONTRACT>

# Ika testnet
https://testnet.ika.xyz/dashboard
```

### View Logs
```bash
# Terminal running `npm run dev`
# Look for mint flow output:
# - Sui payment tx
# - Ika MPC sign request
# - Monad submission tx
```

### Common Issues

| Issue | Fix |
|-------|-----|
| dWallet creation fails | Check IKA coin is funded, not used |
| Contract deployment fails | Ensure MetaMask on Monad testnet (10143) |
| Mint tx fails in UI | Check all 5 Ika/Monad env vars in `.env.local` |
| "Proof already used" error | Each mint needs unique proof hash |
| Ika timeout | Increase `NEXT_PUBLIC_IKA_SIGN_TIMEOUT_MS` to 120000 |

---

## 🔗 Quick Links

- **Ika Testnet**: https://testnet.ika.xyz
- **Ika Docs**: https://docs.ika.xyz
- **Monad RPC**: https://testnet-rpc.monad.xyz/
- **Sui Explorer**: https://testnet.suivision.xyz
- **Monad Explorer**: https://testnet-explorer.monad.xyz

---

## ⚡ Run Setup Guide (Interactive)

Once you have dWallet ID & contract address, run:

```bash
node scripts/setup-complete-flow.mjs
```

Or test all connections:

```bash
node scripts/test-mint-flow.mjs
```

---

## 📋 Summary

| Step | Status | Action |
|------|--------|--------|
| 1. dWallet | ❌ | Go to https://testnet.ika.xyz/dashboard |
| 2. Contract | ❌ | Deploy to Monad via Remix or Hardhat |
| 3. .env.local | ⏳ | Add IDs from steps 1-2 |
| 4. Mint | ⏳ | Test at http://localhost:3001/mint |
