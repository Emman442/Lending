import { it, describe } from "node:test";
import IDL from "../target/idl/lending.json";
import { BanksClient, ProgramTestContext, startAnchor } from "solana-bankrun";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { BankrunProvider } from "anchor-bankrun";
import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import { BankrunContextWrapper } from "../bankrun-utils/bankrunConnection";
import { Program } from "@coral-xyz/anchor";
import { Lending } from "../target/types/lending";
import { createMint, mintTo, createAccount } from "spl-token-bankrun";
import { BN } from "bn.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

describe("Lending Smart Contract Test", async () => {
    let context: ProgramTestContext;
    let provider: BankrunProvider;
    let bankrunContextWrapper: BankrunContextWrapper;
    let program: Program;
    let banksClient: BanksClient;
    let signer: Keypair;
    let usdcBankAccount: PublicKey;
    let solBankAccount: PublicKey;

    const pyth = new PublicKey("7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE");
    const devnetConnection = new Connection("https://api.devnet.solana.com");
    const accountInfo = await devnetConnection.getAccountInfo(pyth);

    context = await startAnchor(
        "",
        [{ name: "lending", programId: new PublicKey(IDL.address) }],
        [{ address: pyth, info: accountInfo }]
    );

    provider = new BankrunProvider(context);
    bankrunContextWrapper = new BankrunContextWrapper(context);
    const connection = bankrunContextWrapper.connection.toConnection();

    const pythSolanaReceiver = new PythSolanaReceiver({
        connection,
        wallet: provider.wallet,
    });

    const SOL_PRICE_FEED_ID =
        "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

    const solUsdPriceFeedAccount = pythSolanaReceiver.getPriceFeedAccountAddress(
        0,
        SOL_PRICE_FEED_ID
    );

    const feedAccountInfo = await devnetConnection.getAccountInfo(solUsdPriceFeedAccount);
    context.setAccount(solUsdPriceFeedAccount, feedAccountInfo);

    //@ts-ignore
    program = new Program<Lending>(IDL as Lending, provider);
    banksClient = context.banksClient;
    signer = provider.wallet.payer;

    const mintUSDC = await createMint({
        banksClient,
        signer,
        mintAuthority: signer.publicKey,
        freezeAuthority: null,
        decimals: 2,
    });

    const mintSOL = await createMint({
        banksClient,
        signer,
        mintAuthority: signer.publicKey,
        freezeAuthority: null,
        decimals: 2,
    });

    [usdcBankAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from("treasury"), mintUSDC.toBuffer()],
        program.programId
    );
    [solBankAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from("treasury"), mintSOL.toBuffer()],
        program.programId
    );


    it("Test Init and Fund Bank", async () => {
        const initUSDCBankTx = await program.methods.initBank(new BN(1)).accounts({ signer: signer.publicKey, mint: mintUSDC, tokenProgram: TOKEN_PROGRAM_ID }).rpc({ commitment: "confirmed" });
        console.log("Create USDC bank Account", initUSDCBankTx);

        const amount = 10_000 * 10 ** 9
        const mintTx = await mintTo(banksClient, signer, mintUSDC, usdcBankAccount, signer, amount);
        console.log("Mint USDC to Bank: ", mintTx)
    });
    it("Test Init User", async () => {
        const initUserTx = await program.methods.InitUser(mintUSDC).accounts({ signer: signer.publicKey }).rpc({ commitment: "confirmed" });
        console.log("Init User: ", initUserTx);
    });

    it("Test Init and Fund Sol Bank", async () => {
        const initSOLBankTx = await program.methods.initBank(new BN(2)).accounts({ signer: signer.publicKey, mint: mintSOL, tokenProgram: TOKEN_PROGRAM_ID }).rpc({ commitment: "confirmed" });
        console.log("Create USDC bank Account", initSOLBankTx);

        const amount = 10_000 * 10 ** 9
        const mintTx = await mintTo(banksClient, signer, mintSOL, usdcBankAccount, signer, amount);
        console.log("Mint SOL to Bank: ", mintTx)
    });

    it("Create and Fund TokenAccounts", async () => {
        const USDCTokenAccount = await createAccount(banksClient, signer, mintUSDC, signer.publicKey)
        console.log("USDC tokenAccount", USDCTokenAccount);

        const amount = 10_000 * 10 ** 9
        const mintUSDCTx = await mintTo(banksClient, signer, mintSOL, usdcBankAccount, signer, amount);
        console.log("Mint USDC to User: ", mintUSDCTx)
    });

    it("Test Deposit", async () => {
        const depositUSDC = await program.methods.deposit(new BN(100000000000000)).accounts({ signer: signer.publicKey, mint: mintUSDC, tokenProgram: TOKEN_PROGRAM_ID }).rpc({ commitment: "confirmed" });
        console.log("deposit USDC", depositUSDC);
    });
    it("Test Borrow", async () => {
        const BorrowSOL = await program.methods.borrow(new BN(1)).accounts({ signer: signer.publicKey, mint: mintSOL, tokenProgram: TOKEN_PROGRAM_ID, priceUpdate: solUsdPriceFeedAccount }).rpc({ commitment: "confirmed" });
        console.log("Borrow SOL", BorrowSOL);
    });
    it("Test Repay", async () => {
        const repaySOL = await program.methods.repay(new BN(1)).accounts({ signer: signer.publicKey, mint: mintSOL, tokenProgram: TOKEN_PROGRAM_ID}).rpc({ commitment: "confirmed" });
        console.log("Repay SOL", repaySOL);
    });
    it("Test Withdraw", async () => {
        const withdrawSOL = await program.methods.withdraw(new BN(100)).accounts({ signer: signer.publicKey, mint: mintUSDC, tokenProgram: TOKEN_PROGRAM_ID}).rpc({ commitment: "confirmed" });
        console.log("withdraw SOL", withdrawSOL);
    });
});
