import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getAirdrop, getEntryPoint, getHexlinkPaymaster, loadConfig } from "./utils";
import { Contract, ethers } from "ethers";

task("create_campaign", "create new campaign")
    .addOptionalParam("token")
    .addOptionalParam("endat")
    .addOptionalParam("amount")
    .addOptionalParam("validator")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const airdrop = await getAirdrop(hre);
        const airdropAddr = await airdrop.getAddress();
        const {deployer} = await hre.ethers.getNamedSigners();
        const token = args.token ?? "0x37a56cdcD83Dce2868f721De58cB3830C44C6303";
        const amount = args.amount ?? 50n * (10n ** 9n);
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
            const tx = await erc20.approve(airdropAddr, amount);
            await tx.wait();
        }
        const campaign = {
            token,
            startAt: 0,
            endAt: args.endat ?? "0xffffffffffff",
            deposit: amount,
            validator: validator,
            owner: loadConfig(hre, "safe") ?? deployer.address,
            mode: 1,
        };
        console.log("Creating campaign: ", campaign);
        console.log(airdrop.interface.encodeFunctionData("createCampaign", [campaign]));
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

task("check_airdrop", "Get campaign info")
    .setAction(async (_args, hre : HardhatRuntimeEnvironment) => {
        const airdrop = await getAirdrop(hre);
        const entryPoint = await getEntryPoint(hre);
        const hpaymaster = await getHexlinkPaymaster(hre);
        console.log({
            owner: await airdrop.owner(),
            airdropImpl: await airdrop.implementation(),
            airdrop: await airdrop.getAddress(),
            paused: await airdrop.paused(),
            nextCampaign: await airdrop.getNextCampaign(),
            paymaster: {
                address: await hpaymaster.getAddress(),
                owner: await hpaymaster.owner(),
                implementation: await hpaymaster.implementation(),
                hexlink: await hpaymaster.hexlink(),
                hexlinkDev: await hpaymaster.hexlinkDev(),
                entrypoint: await hpaymaster.entryPoint(),
                airdropApproved: await hpaymaster.isApproved(
                    await airdrop.getAddress(),
                    airdrop.interface.getFunction("claimV2")?.selector
                ),
                deposit: await entryPoint.getDepositInfo(await hpaymaster.getAddress()),
            }
        });
    });

task("cleanup_paymaster", "cleanup paymaster")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const paymaster = await getHexlinkPaymaster(hre);
        console.log("withdrawing 1 native token for ", paymaster.target);
        const {deployer} = await hre.getNamedAccounts();
        await paymaster.withdrawTo(
            deployer,
            await paymaster.getDeposit()
        );
        const entrypoint = await getEntryPoint(hre);
        const depositInfo = await entrypoint.getDepositInfo(await paymaster.getAddress());
        if (depositInfo.staked) {
            await paymaster.unlockStake();
        }
    });

task("setup_paymaster", "setup paymaster")
    .addParam("deposit")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const paymaster = await getHexlinkPaymaster(hre);
        console.log("depositing 1 native token for ", paymaster.target);
        await paymaster.deposit({value: ethers.parseEther(args.deposit)});
        
        const entrypoint = await getEntryPoint(hre);
        const depositInfo = await entrypoint.getDepositInfo(await paymaster.getAddress());
        if (depositInfo.stake === 0) {
            console.log("staking 0.05 native token for ", paymaster.target);
            await paymaster.addStake(86400, {value: ethers.parseEther("0.05")});
        }
    });
