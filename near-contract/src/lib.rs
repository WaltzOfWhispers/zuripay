use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, near_bindgen, BorshDeserialize, BorshSerialize, PanicOnDefault};

/// Payment intent posted to NEAR for solver fulfillment.
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct PaymentIntent {
    pub id: String,              // UUID for this intent
    pub payment_id: String,      // Backend payment id
    pub dest_chain: String,      // e.g. "ethereum-sepolia"
    pub dest_asset: String,      // e.g. "ETH"
    pub dest_address: String,    // Recipient address on destination chain
    pub amount_wei: u128,        // Amount denominated in wei for ETH
    pub zcash_burn_txid: String, // Optional ZEC burn reference
    pub created_at: u64,         // Milliseconds since epoch
    pub fulfilled: bool,         // Whether solver paid out
    pub payout_tx_hash: Option<String>,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct Contract {
    intents: Vec<PaymentIntent>,
}

#[near_bindgen]
impl Contract {
    #[init]
    pub fn new() -> Self {
        Self { intents: Vec::new() }
    }

    /// Create a new intent. In a production setting we would add access control
    /// to ensure only the orchestrator account can post intents.
    pub fn create_intent(&mut self, intent: PaymentIntent) {
        self.intents.push(intent);
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

    fn setup() -> Contract {
        let context = VMContextBuilder::new().build();
        testing_env!(context);
        Contract::new()
    }

    fn sample_intent(id: &str) -> PaymentIntent {
        PaymentIntent {
            id: id.to_string(),
            payment_id: "payment-123".to_string(),
            dest_chain: "ethereum-sepolia".to_string(),
            dest_asset: "ETH".to_string(),
            dest_address: "0xBob".to_string(),
            amount_wei: 1000,
            zcash_burn_txid: "burn123".to_string(),
            created_at: 1,
            fulfilled: false,
            payout_tx_hash: None,
        }
    }

    #[test]
    fn create_and_list_intent() {
        let mut contract = setup();
        contract.create_intent(sample_intent("intent-1"));

        let open = contract.list_open_intents();
        assert_eq!(open.len(), 1);
        assert_eq!(open[0].id, "intent-1");
    }

    #[test]
    fn mark_intent_fulfilled() {
        let mut contract = setup();
        contract.create_intent(sample_intent("intent-1"));

        contract.mark_fulfilled("intent-1".to_string(), "payout-hash".to_string());

        let intent = contract.get_intent("intent-1".to_string()).unwrap();
        assert!(intent.fulfilled);
        assert_eq!(intent.payout_tx_hash, Some("payout-hash".to_string()));
    }
}
