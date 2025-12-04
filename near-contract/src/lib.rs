use near_sdk::borsh::{self, BorshDeserialize, BorshSchema, BorshSerialize};
use near_sdk::near;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, near_bindgen, AccountId, PanicOnDefault};
use schemars::JsonSchema;

/// Payment intent posted to NEAR for solver fulfillment.
#[derive(
    BorshDeserialize,
    BorshSerialize,
    BorshSchema,
    Serialize,
    Deserialize,
    JsonSchema,
    Clone
)]
#[serde(crate = "near_sdk::serde")]
pub struct PaymentIntent {
    pub id: String,              // UUID for this intent
    pub payment_id: String,      // Backend payment id
    pub dest_chain: String,      // e.g. "ethereum-sepolia"
    pub dest_asset: String,      // e.g. "ETH"
    pub dest_address: String,    // Recipient address on destination chain
    pub amount_atomic: u128,     // Amount denominated in smallest unit for the asset
    pub decimals: u8,            // Decimal places for dest_asset
    pub zcash_burn_txid: String, // Optional ZEC burn reference
    pub created_at: u64,         // Milliseconds since epoch
    pub fulfilled: bool,         // Whether solver paid out
    pub payout_tx_hash: Option<String>,
}

#[derive(Serialize, Deserialize, JsonSchema)]
#[serde(crate = "near_sdk::serde")]
pub struct PaymentIntentInput {
    pub id: String,
    pub payment_id: String,
    pub dest_chain: String,
    pub dest_asset: String,
    pub dest_address: String,
    pub amount_atomic: String,
    pub decimals: u8,
    pub zcash_burn_txid: String,
    pub created_at: String,
    pub fulfilled: bool,
    pub payout_tx_hash: Option<String>,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    intents: Vec<PaymentIntent>,
    owner: AccountId,
}

#[near_bindgen]
impl Contract {
    #[init]
    pub fn new(owner: AccountId) -> Self {
        Self {
            intents: Vec::new(),
            owner,
        }
    }

    fn assert_owner(&self) {
        let caller = env::predecessor_account_id();
        assert_eq!(
            caller,
            self.owner,
            "Only the owner can call this method (caller: {}, owner: {})",
            caller,
            self.owner
        );
    }

    /// Create a new intent. In a production setting we would add access control
    /// to ensure only the orchestrator account can post intents.
    pub fn create_intent(&mut self, intent: PaymentIntentInput) {
        self.assert_owner();
        let amount_atomic = intent
            .amount_atomic
            .parse::<u128>()
            .unwrap_or(0);
        let created_at = intent
            .created_at
            .parse::<u64>()
            .unwrap_or(0);
        let stored = PaymentIntent {
            id: intent.id,
            payment_id: intent.payment_id,
            dest_chain: intent.dest_chain,
            dest_asset: intent.dest_asset,
            dest_address: intent.dest_address,
            amount_atomic,
            decimals: intent.decimals,
            zcash_burn_txid: intent.zcash_burn_txid,
            created_at,
            fulfilled: intent.fulfilled,
            payout_tx_hash: intent.payout_tx_hash,
        };
        self.intents.push(stored);
        env::log_str("intent created");
    }

    /// List intents that have not been fulfilled yet.
    pub fn list_open_intents(&self) -> Vec<PaymentIntent> {
        self.intents
            .iter()
            .cloned()
            .filter(|i| !i.fulfilled)
            .collect()
    }

    /// Mark an intent fulfilled with the payout tx hash.
    pub fn mark_fulfilled(&mut self, id: String, payout_tx_hash: String) {
        self.assert_owner();
        for intent in &mut self.intents {
            if intent.id == id {
                intent.fulfilled = true;
                intent.payout_tx_hash = Some(payout_tx_hash.clone());
                env::log_str("intent fulfilled");
                break;
            }
        }
    }

    /// Fetch a specific intent by id.
    pub fn get_intent(&self, id: String) -> Option<PaymentIntent> {
        self.intents.iter().find(|i| i.id == id).cloned()
    }
}

// Basic unit tests for contract behavior.
#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    fn setup(owner: &str) -> Contract {
        let owner_id: AccountId = owner.parse().unwrap();
        let context = VMContextBuilder::new()
            .predecessor_account_id(owner_id.clone())
            .build();
        testing_env!(context);
        Contract::new(owner_id)
    }

    fn sample_intent(id: &str) -> PaymentIntent {
        PaymentIntent {
            id: id.to_string(),
            payment_id: "payment-123".to_string(),
            dest_chain: "ethereum-sepolia".to_string(),
            dest_asset: "ETH".to_string(),
            dest_address: "0xBob".to_string(),
            amount_atomic: U128(1000),
            decimals: 18,
            zcash_burn_txid: "burn123".to_string(),
            created_at: U64(1),
            fulfilled: false,
            payout_tx_hash: None,
        }
    }

    #[test]
    fn create_and_list_intent() {
        let mut contract = setup("alice.testnet");
        contract.create_intent(sample_intent("intent-1"));

        let open = contract.list_open_intents();
        assert_eq!(open.len(), 1);
        assert_eq!(open[0].id, "intent-1");
    }

    #[test]
    fn mark_intent_fulfilled() {
        let mut contract = setup("alice.testnet");
        contract.create_intent(sample_intent("intent-1"));

        contract.mark_fulfilled("intent-1".to_string(), "payout-hash".to_string());

        let intent = contract.get_intent("intent-1".to_string()).unwrap();
        assert!(intent.fulfilled);
        assert_eq!(intent.payout_tx_hash, Some("payout-hash".to_string()));
    }
}
