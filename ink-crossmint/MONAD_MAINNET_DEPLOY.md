# Monad Mainnet Deployment

## Current Mainnet Settings

- Network: Monad Mainnet
- Chain ID: `143`
- RPC: `https://rpc.monad.xyz`
- Gas token: `MON`
- Receipt contract: `0x6da58b24567ab1f520f52bb55e7769b01e9e2c6d`
- Deploy tx: `0x5faea2d4891a68d90c37a7562abf34a44b22f446493389a4497d77749b7e27d9`
- Ika minter: `0x904ECdBA6F996789e1BA8Ef17b4B9fE622Ab764D`

The Sui mainnet package and Monad mainnet receipt contract are already deployed.

## Required Env

```env
NEXT_PUBLIC_MONAD_RPC_URL=https://rpc.monad.xyz
NEXT_PUBLIC_MONAD_CHAIN_ID=143
MONAD_PRIVATE_KEY=<funded Monad mainnet deployer key>
NEXT_PUBLIC_IKA_DWALLET_EVM_ADDRESS=0x904ECdBA6F996789e1BA8Ef17b4B9fE622Ab764D
NEXT_PUBLIC_MONAD_RECEIPT_CONTRACT=0x6da58b24567ab1f520f52bb55e7769b01e9e2c6d
```

## Deploy Flow

```bash
npm run deploy:monad
```

The deploy script compiles `contracts/monad/InkPassReceipt.sol`, checks the RPC chain ID, deploys with the configured Ika dWallet EVM signer, and writes:

```env
NEXT_PUBLIC_MONAD_RECEIPT_CONTRACT=0x6da58b24567ab1f520f52bb55e7769b01e9e2c6d
```

If the Ika signer changes after deploy, run:

```bash
npm run monad:set-minter
```
