module ink_genesis_pass::ink_genesis_pass;

use sui::clock::{Self, Clock};
use sui::coin::{Self, Coin};
use sui::event;
use sui::object::{Self, UID};
use sui::sui::SUI;
use sui::transfer;
use sui::tx_context::{Self, TxContext};
use std::string::{Self, String};

const E_SUPPLY_CAP_REACHED: u64 = 0;
const E_INSUFFICIENT_PAYMENT: u64 = 1;
const SUPPLY_CAP: u64 = 250;
const MINT_PRICE_MIST: u64 = 1_500_000_000;

public struct AdminCap has key, store {
    id: UID,
}

public struct Collection has key {
    id: UID,
    name: String,
    description: String,
    image_url: String,
    minted: u64,
    max_supply: u64,
    treasury: address,
}

public struct PaymentAccepted has copy, drop {
    payer: address,
    mint_number: u64,
    monad_address_hash: vector<u8>,
    paid_at: u64,
}

fun init(ctx: &mut TxContext) {
    let admin = AdminCap { id: object::new(ctx) };
    let collection = Collection {
        id: object::new(ctx),
        name: string::utf8(b"Ink Genesis Pass"),
        description: string::utf8(
            b"Sui payment receipt for an Ink Genesis Pass NFT minted on Monad through Ink + Ika.",
        ),
        image_url: string::utf8(b"ipfs://bafkreihqp7t3lq7d3hifchcfanwqm5ezjrrfexf5yom6cy66jg422naqfm"),
        minted: 0,
        max_supply: SUPPLY_CAP,
        treasury: tx_context::sender(ctx),
    };

    transfer::transfer(admin, tx_context::sender(ctx));
    transfer::share_object(collection);
}

#[allow(lint(public_entry))]
public entry fun mint(
    collection: &mut Collection,
    clock: &Clock,
    payment: Coin<SUI>,
    monad_address_hash: vector<u8>,
    _monad_nft_uri: String,
    ctx: &mut TxContext,
) {
    assert!(collection.minted < collection.max_supply, E_SUPPLY_CAP_REACHED);
    assert!(coin::value(&payment) >= MINT_PRICE_MIST, E_INSUFFICIENT_PAYMENT);

    let sender = tx_context::sender(ctx);
    let mint_number = collection.minted + 1;
    collection.minted = mint_number;

    let paid_at = clock::timestamp_ms(clock);

    event::emit(PaymentAccepted {
        payer: sender,
        mint_number,
        monad_address_hash,
        paid_at,
    });

    transfer::public_transfer(payment, collection.treasury);
}

public fun minted(collection: &Collection): u64 {
    collection.minted
}

public fun max_supply(collection: &Collection): u64 {
    collection.max_supply
}
