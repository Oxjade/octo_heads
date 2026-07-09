# Ika dWallet + Monad NFT Mint Setup Guide

## Phase 1: Generate dWallet With Ink SDK CLI

### 1.1 Install

The repo includes the published Ink SDK packages:

```bash
npm install
```

Relevant packages:
- `@ink-sdk/sdk`
- `@ink-sdk/evm`

### 1.2 Prepare env

Ink's EVM dWallet creation path needs a Sui ED25519 key plus funded IKA/SUI coin object IDs:

```env
IKA_SUI_PRIVATE_KEY=
IKA_COIN_ID=
IKA_SUI_COIN_ID=
IKA_GAS_COIN_ID=
IKA_NETWORK=testnet
IKA_SUI_RPC=
```

`IKA_COIN_ID` may reuse the existing `NEXT_PUBLIC_IKA_COIN_OBJECT_ID` value.

### 1.3 Run the CLI

Create the Ika-backed EVM dWallet and write the generated IDs to `.env.local`:

```bash
npm run ink:dwallet
```

Equivalent explicit form:

```bash
npm run cli -- create \
  --env-file .env.local \
  --network testnet \
  --write-env \
  --json
```

The CLI writes both Ink SDK names and app names:
- `IKA_DWALLET_ID`
- `IKA_DWALLET_CAP_ID`
- `IKA_ETH_ADDRESS`
- `IKA_PRESIGN_ID`
- `IKA_UNVERIFIED_PRESIGN_CAP_ID`
- `NEXT_PUBLIC_IKA_DWALLET_ID`
- `NEXT_PUBLIC_IKA_DWALLET_CAP_ID`
- `NEXT_PUBLIC_IKA_DWALLET_EVM_ADDRESS`
- `NEXT_PUBLIC_IKA_PRESIGN_ID`
- `NEXT_PUBLIC_IKA_UNVERIFIED_PRESIGN_CAP_ID`

---

## Phase 2: Deploy Monad InkPassReceipt Contract

### 2.1 Set up Monad testnet RPC

Already configured in `.env.example`:
```
NEXT_PUBLIC_MONAD_RPC_URL=https://testnet-rpc.monad.xyz/
NEXT_PUBLIC_MONAD_CHAIN_ID=10143
```

### 2.2 Get Monad testnet tokens

Deploying to Monad testnet requires MON gas. Use the official faucet:

https://faucet.monad.xyz

### 2.3 Deploy contract to Monad testnet

Set a funded deployer private key locally. Prefer a fresh testnet-only key.

```bash
export MONAD_PRIVATE_KEY=0x...
npm run deploy:monad
```

The deploy script compiles `contracts/monad/InkPassReceipt.sol`, deploys it with `NEXT_PUBLIC_IKA_DWALLET_EVM_ADDRESS` as the constructor argument, and saves `NEXT_PUBLIC_MONAD_RECEIPT_CONTRACT` back to `.env.local`.

---

## Phase 3: Test End-to-End Flow

### 3.1 Start dev server

```bash
npm run dev
```

Server runs at: http://localhost:3001

### 3.2 Test Sui payment + Ika sign + Monad mint

1. Navigate to `/mint`
2. Connect your Sui wallet
3. Click "Mint NFT"
4. Flow:
   - ✅ Pays 1.5 SUI on Sui testnet
   - ✅ Requests Ika MPC signature (sign Monad tx)
   - ✅ Submits signed tx to Monad testnet
   - ✅ NFT minted to `NEXT_PUBLIC_IKA_DWALLET_EVM_ADDRESS` on Monad

### 3.3 Verify mint

Check Monad testnet explorer:
- Explorer: https://testnet-explorer.monad.xyz
- Contract: `NEXT_PUBLIC_MONAD_RECEIPT_CONTRACT`
- Look for `InkGenesisPassMinted` events

---

## Final .env.local Template

```
# Sui
NEXT_PUBLIC_SUI_NETWORK=testnet
NEXT_PUBLIC_SUI_PACKAGE_ID=<your_sui_package>
NEXT_PUBLIC_SUI_COLLECTION_ID=<your_sui_collection>

# Monad
NEXT_PUBLIC_MONAD_RPC_URL=https://testnet-rpc.monad.xyz/
NEXT_PUBLIC_MONAD_CHAIN_ID=10143
NEXT_PUBLIC_MONAD_RECEIPT_CONTRACT=0x...

# Ika dWallet
NEXT_PUBLIC_IKA_NETWORK=testnet
NEXT_PUBLIC_IKA_COIN_OBJECT_ID=0x...
NEXT_PUBLIC_IKA_DWALLET_ID=0x...
NEXT_PUBLIC_IKA_DWALLET_CAP_ID=0x...
NEXT_PUBLIC_IKA_DWALLET_EVM_ADDRESS=0x...
NEXT_PUBLIC_IKA_SUI_FEE_MIST=10000000
NEXT_PUBLIC_IKA_SIGN_TIMEOUT_MS=90000

# Storage
NFT_STORAGE_TOKEN=<optional>
PINATA_JWT=<optional>

# App
NEXT_PUBLIC_APP_URL=https://useink.xyz
NEXT_PUBLIC_COLLECTION_SUPPLY=250
NEXT_PUBLIC_MINT_PRICE=1.5
NEXT_PUBLIC_MINT_PRICE_MIST=1500000000
```

---

## Troubleshooting

**dWallet creation fails**
- Check `IKA_SUI_PRIVATE_KEY`, `IKA_COIN_ID`, and `IKA_SUI_COIN_ID` are set
- Check the IKA/SUI coin objects are funded and not already spent
- Ensure correct network (`testnet`)
- Check Ink SDK guide: https://useink.xyz/sdk
- Check Ika docs: https://docs.ika.xyz

**Monad contract deployment fails**
- Verify chain ID is 10143
- Check Monad testnet RPC is accessible
- Ensure `ikaMinter` is set to a valid EVM address
- Ensure the deployer address has MON from https://faucet.monad.xyz

**Mint transaction fails**
- Check `/mint` console logs
- Verify all 5 Ika env vars are set
- Ensure Sui account has SUI for gas
- Check Monad contract is deployed at configured address

---

## Useful Links

- Ika Testnet: https://testnet.ika.xyz
- Ink SDK guide: https://useink.xyz/sdk
- Ika Docs: https://docs.ika.xyz
- Monad Testnet RPC: https://testnet-rpc.monad.xyz
- Monad Faucet: https://faucet.monad.xyz
- Sui Testnet: https://testnet.suivision.xyz
