# Sui Mainnet Deployment

## Current Mainnet Settings

- Network: `mainnet`
- RPC: `https://fullnode.mainnet.sui.io:443`
- Payment receiver: `0x05b2a9dd20f1b50ab289ed134aeb6d78fa24687b5dd0512bd914c059d3fe116e`
- Mint price: `1.5 SUI`
- Package ID: `0xd141d239b780e2cdddf74a82266ee983d9ef500655c59b72446af1426a10b0aa`
- Collection ID: `0xddcd5a0692ecabadfd3f4c405fd9897b4bc5887401335893512327660941190b`
- Publish tx: `BSKrqooPRpcJZcA48NgLVzy1JU4b4sdjobEVhoUmjP9t`

The Sui package source defaults the collection treasury to the payment receiver above.

## Before Publishing

1. Use a Sui mainnet wallet funded with enough SUI for publish gas.
2. Make sure `.env.local` has:

```env
NEXT_PUBLIC_SUI_NETWORK=mainnet
NEXT_PUBLIC_SUI_RPC_URL=https://fullnode.mainnet.sui.io:443
SUI_RPC_URL=https://fullnode.mainnet.sui.io:443
IKA_NETWORK=mainnet
IKA_SUI_RPC=https://fullnode.mainnet.sui.io:443
```

3. Keep these blank until mainnet objects exist:

```env
NEXT_PUBLIC_SUI_PACKAGE_ID=
NEXT_PUBLIC_SUI_COLLECTION_ID=
NEXT_PUBLIC_IKA_COIN_OBJECT_ID=
NEXT_PUBLIC_IKA_DWALLET_ID=
NEXT_PUBLIC_IKA_DWALLET_CAP_ID=
NEXT_PUBLIC_IKA_DWALLET_EVM_ADDRESS=
```

## Publish Flow

```bash
sui client switch --env mainnet
sui client publish contracts/sui --gas-budget 100000000
```

After publish, copy the created package ID and shared `Collection` object ID into:

```env
NEXT_PUBLIC_SUI_PACKAGE_ID=0xd141d239b780e2cdddf74a82266ee983d9ef500655c59b72446af1426a10b0aa
NEXT_PUBLIC_SUI_COLLECTION_ID=0xddcd5a0692ecabadfd3f4c405fd9897b4bc5887401335893512327660941190b
```

Then create/configure the mainnet Ika objects and fill the mainnet Ika env values.
