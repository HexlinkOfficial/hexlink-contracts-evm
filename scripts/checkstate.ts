import { ethers, network } from "hardhat";
import * as config from '../config.json';

async function main() {
    const netConf = config[network.name as keyof typeof config] || {};
    const oracles = netConf["oracles"] || {};
    const emailOtpOracle = await ethers.getContractAt(
        "SimpleIdentityOracle",
        oracles["EMAIL_OTP"], // email otp
    );
    const twitterOAuthOracle = await ethers.getContractAt(
        "SimpleIdentityOracle",
        oracles["TWITTER_OAUTH"] // twitter oauth
    );

    const validator = new ethers.Wallet(process.env.HARDHAT_VALIDATOR);
    const kmsPubAddr1 = "0x943fabe0d1ae7130fc48cf2abc85f01fc987ec81";
    const kmsPubAddr2 = "0x72cf1663d40c5215e5f9607df3464becdffd59d9";

    console.log("Email OTP Oracle: ");
    console.log(await emailOtpOracle.isRegistered(validator.address));
    console.log(await emailOtpOracle.isRegistered(kmsPubAddr1));
    console.log(await emailOtpOracle.isRegistered(kmsPubAddr2));

    console.log("Twitter OAuth Oracle: ");
    console.log(await twitterOAuthOracle.isRegistered(validator.address));
    console.log(await twitterOAuthOracle.isRegistered(kmsPubAddr1));
    console.log(await twitterOAuthOracle.isRegistered(kmsPubAddr2));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});