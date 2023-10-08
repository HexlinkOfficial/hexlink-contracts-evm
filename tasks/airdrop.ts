import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getAirdrop, getAirdropPaymaster, getEntryPoint, loadConfig } from "./utils";
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
            endAt: args.endAt ?? "0xffffffffffff",
            deposit: amount,
            validator: validator,
            owner: loadConfig(hre, "safe") ?? deployer.address,
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

task("check_airdrop", "Get campaign info")
    .setAction(async (_args, hre : HardhatRuntimeEnvironment) => {
        const airdrop = await getAirdrop(hre);
        const paymaster = await getAirdropPaymaster(hre);
        const paymasterDev = await getAirdropPaymaster(hre, true);
        const entryPoint = await getEntryPoint(hre);
        console.log({
            owner: await airdrop.owner(),
            airdropImpl: await airdrop.implementation(),
            airdrop: await airdrop.getAddress(),
            paused: await airdrop.paused(),
            nextCampaign: await airdrop.getNextCampaign(),
            paymaster: {
                address: await paymaster.getAddress(),
                owner: await paymaster.owner(),
                airdrop: await paymaster.airdrop(),
                hexlink: await paymaster.hexlink(),
                deposit: await entryPoint.getDepositInfo(await paymaster.getAddress()),
            },
            paymasterDev: {
                address: await paymasterDev.getAddress(),
                owner: await paymasterDev.owner(),
                airdrop: await paymasterDev.airdrop(),
                hexlink: await paymasterDev.hexlink(),
                deposit: await entryPoint.getDepositInfo(await paymasterDev.getAddress()),
            }
        });
    });

task("upgrade_airdrop", "upgrade airdrop contract")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const airdrop = await getAirdrop(hre, args.dev);
        const existing = await airdrop.implementation();
        const latest = await hre.deployments.get("Airdrop");
        if (existing.toLowerCase() == latest.address.toLowerCase()) {
            console.log("No need to upgrade");
            return;
        }
        console.log("Upgrading from " + existing + " to " + latest.address);
        const tx = await airdrop.upgradeTo(latest.address);
        console.log(await tx.wait());
    });

task("setup_paymaster", "setup paymaster")
    .addParam("deposit")
    .addFlag("dev")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const paymaster = await getAirdropPaymaster(hre, args.dev);
        console.log("depositing 1 native token for ", paymaster.target);
        await paymaster.deposit({value: ethers.parseEther(args.deposit)});
        console.log("staking 0.05 native token for ", paymaster.target);
        await paymaster.addStake(86400, {value: ethers.parseEther("0.05")});
    });

task("cleanup_paymaster", "cleanup paymaster")
    .addFlag("dev")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const paymaster = await getAirdropPaymaster(hre, args.dev);
        console.log("withdrawing 1 native token for ", paymaster.target);
        const {deployer} = await hre.getNamedAccounts();
        await paymaster.withdrawTo(
            deployer,
            await paymaster.getDeposit()
        );
    });
