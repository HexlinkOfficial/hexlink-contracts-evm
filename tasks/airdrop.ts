import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getAirdrop, getValidator } from "./utils";
import { Contract } from "ethers";

task("create_campaign", "create new campaign")
    .addOptionalParam("token")
    .addOptionalParam("endat")
    .addOptionalParam("amount")
    .addOptionalParam("validator")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const airdrop = await getAirdrop(hre);
        const airdropAddr = await airdrop.getAddress();
        const {deployer} = await hre.ethers.getNamedSigners();
        const token = args.token ?? "0xEC5dCb5Dbf4B114C9d0F65BcCAb49EC54F6A0867";
        const amount = BigInt(args.amount ?? 10n ** 18n);
        const validator = args.validator ?? deployer.address;
        const erc20 = new Contract(
            token,
            [
                "function approve(address, uint256) public returns(bool)",
                "function allowance(address, address) public view returns(uint256 remaining)",
            ],
            deployer
        );
        const allownence = await erc20.allowance(deployer.address, airdropAddr);
        if (allownence < amount) {
            console.log("Approving token...");
            await erc20.approve(airdropAddr, amount);
        }
        const campaign = {
            token,
            startAt: 0,
            endAt: args.endAt ?? "0xffffffffffff",
            deposit: amount,
            owner: validator,
        };
        console.log("Creating campaign: ", campaign);
        const tx = await airdrop.createCampaign(campaign);
        console.log("Tx sent: ", tx.hash);
        const receipt = await tx.wait();
        console.log("Tx mined: ", receipt);
    });

task("get_campaign", "Get campaign info")
    .addParam("id")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const airdrop = await getAirdrop(hre);
        const campaign = await airdrop.getCampaign(args.id);
        console.log("campaign: ", campaign);
    });
