use anchor_lang::prelude::*;


#[error_code]
pub enum ErrorCode{
    #[msg("Insufficient Funds")]
    InsufficientFunds,
    
    #[msg("Over Borrowable Amount!")]
    OverBorrowableAmount,

    #[msg("Repay Amount Exceeds Borrowed amount!")]
    OverRepay,

    #[msg("User Is not under collateralized!, Can't be liquidated")]
    NotUnderCollateralized,
}