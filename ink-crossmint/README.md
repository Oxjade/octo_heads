# Ink CrossMint

Ink CrossMint is a working demo of a multi-chain mint flow powered by Ink SDK and Ika dWallet signing.

Users pay  on Sui. The app then uses Ink + Ika coordination to mint the actual NFT on Monad. Sui is only the payment and intent chain; the NFT contract and token ownership live on Monad.

## What It Does

The mint flow is:

1. User connects a Sui wallet.
2. User enters the Monad address that should receive the NFT.
3. The app builds a Sui payment transaction for `1.5 SUI`.
4. The Sui transaction emits a payment receipt event.
5. The app derives a proof hash from the Sui receipt, payer, mint number, and Monad recipient.
6. Ika dWallet signs a Monad `mintPass(...)` transaction.
7. The Monad NFT contract mints `Ink Genesis Pass` to the Monad recipient.

The result is a Monad NFT backed by a Sui payment receipt.

## How Ink SDK Is Used

This repo uses Ink SDK concepts in two places:

- `@ink-sdk/sdk` and `IkaEvmSigningConnector` coordinate Ika dWallet signing for EVM execution.
- The local `BrowserInkAdapter` wraps the app flow into one product-level interface: connect user, accept Sui payment, then generate/submit the Monad mint proof.

Key files:

- `lib/ink/InkAdapter.ts` connects Sui and Monad identities and builds the Sui payment step.
- `lib/ika/mpc.ts` builds Ika dWallet, presign, signing, and Monad submission transactions.
- `scripts/ink-cli.mjs` creates an Ink/Ika dWallet and writes the required env values.
- `scripts/mint-one.mjs` runs the full Sui payment + Ika signing + Monad mint flow from the CLI.

Ink is not bridging the NFT. It is coordinating the signing and cross-chain product flow so one app can turn a Sui payment into a Monad NFT mint.

## Current Testnet Deployments

Sui payment package:

```text
0x21f91de94185885d284d4d6f046f0266bdfee29a7e9cbb2ad6aec6ad883dd674
```

Sui payment collection:

```text
0xa7fd55a0bbc3f26329d0bbb367d527396951e6b13a720de2cb27a631b7784992
```

Monad NFT contract:

```text
0x58a8c8ac525c890fe0a9abed33345a7ca06fe57e
```

## Run Locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open:

```text
http://localhost:3000/mint
```

## Environment

The main public app settings are:

```env
NEXT_PUBLIC_SUI_NETWORK=testnet
NEXT_PUBLIC_SUI_RPC_URL=https://sui-testnet-rpc.publicnode.com
NEXT_PUBLIC_SUI_GRAPHQL_URL=
NEXT_PUBLIC_SUI_PACKAGE_ID=
NEXT_PUBLIC_SUI_COLLECTION_ID=

NEXT_PUBLIC_MONAD_RPC_URL=https://testnet-rpc.monad.xyz/
NEXT_PUBLIC_MONAD_CHAIN_ID=10143
NEXT_PUBLIC_MONAD_RECEIPT_CONTRACT=

NEXT_PUBLIC_MINT_PRICE=1.5
NEXT_PUBLIC_MINT_PRICE_MIST=1500000000
```

Ika/Ink signing settings:

```env
IKA_SUI_PRIVATE_KEY=
IKA_COIN_ID=
IKA_SUI_COIN_ID=
IKA_GAS_COIN_ID=
IKA_DWALLET_ID=
IKA_DWALLET_CAP_ID=
IKA_ETH_ADDRESS=
IKA_PRESIGN_ID=
IKA_UNVERIFIED_PRESIGN_CAP_ID=
IKA_USER_SHARE_ENCRYPTION_KEYS_B64=
```

Monad deployer:

```env
MONAD_PRIVATE_KEY=
```

## Create The Ink/Ika dWallet

After funding the Sui/Ika account and setting the required Ika env values:

```bash
npm run ink:dwallet
```

This uses Ink SDK with `IkaEvmSigningConnector` and writes the generated dWallet, EVM address, presign, and cap IDs into `.env.local`.

## Deploy

Build the Sui package:

```bash
npm run move:build
```

Publish the Sui package with the Sui CLI, then update:

```env
NEXT_PUBLIC_SUI_PACKAGE_ID=
NEXT_PUBLIC_SUI_COLLECTION_ID=
```

Deploy the Monad NFT contract:

```bash
npm run deploy:monad
```

The deploy script compiles `contracts/monad/InkPassReceipt.sol`, deploys it to Monad testnet, and saves:

```env
NEXT_PUBLIC_MONAD_RECEIPT_CONTRACT=
```

## Test The Full Mint

Run the app flow in the browser:

```bash
npm run dev
```

Or run the scripted flow:

```bash
node scripts/mint-one.mjs
```

The script prints:

- Sui payment receipt digest
- proof hash
- Monad mint transaction hash
- token owner
- token metadata image URL

## GraphQL RPC

The app supports optional Sui GraphQL RPC settings:

```env
NEXT_PUBLIC_SUI_GRAPHQL_URL=
SUI_GRAPHQL_URL=
```

Check a configured GraphQL endpoint with:

```bash
npm run sui:graphql
```

The public Sui JSON-RPC endpoint does not automatically expose `/graphql`. Use a GraphQL-enabled Sui provider or self-hosted GraphQL RPC if you want GraphQL reads/indexing.

## Contracts

Sui:

- `contracts/sui/sources/ink_genesis_pass.move`
- Accepts `1.5 SUI`
- Emits `PaymentAccepted`
- Does not mint a Sui NFT

Monad:

- `contracts/monad/InkPassReceipt.sol`
- Mints the `Ink Genesis Pass` NFT
- Restricts `mintPass(...)` to the configured Ika dWallet minter
- Stores metadata as base64 JSON with an HTTPS image URL

## Expected Timing

Typical testnet mint time:

- Sui payment: `10-20s`
- Ika signing/presign: `1-3min`
- Monad confirmation: `10-30s`

Most of the wait is Ika signing and receipt confirmation, not the Sui payment amount.
