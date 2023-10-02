import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getAirdrop, getAirdropPaymaster } from "./utils";
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
            const tx = await erc20.approve(airdropAddr, amount);
            await tx.wait();
        }
        const campaign = {
            token,
            startAt: 0,
            endAt: args.endAt ?? "0xffffffffffff",
            deposit: amount,
            validator: validator,
            owner: deployer.address,
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
        console.log({
            owner: await airdrop.owner(),
            airdropImpl: await airdrop.implementation(),
            airdrop: await airdrop.getAddress(),
            paused: await airdrop.paused(),
            paymaster: {
                owner: await paymaster.owner(),
                airdrop: await paymaster.airdrop(),
                hexlink: await paymaster.hexlink(),
            },
            paymasterDev: {
                owner: await paymasterDev.owner(),
                airdrop: await paymasterDev.airdrop(),
                hexlink: await paymasterDev.hexlink(),
            }
        });
    });

task("upgrade_airdrop", "upgrade airdrop contract")
    .setAction(async (args, hre : HardhatRuntimeEnvironment) => {
        const airdrop = await getAirdrop(hre, args.dev);
        const proxy = await hre.ethers.getContractAt(
              "HexlinkERC1967Proxy", await airdrop.getAddress());
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
    .setAction(async (_args, hre : HardhatRuntimeEnvironment) => {
        const paymaster = await getAirdropPaymaster(hre);
        console.log("depositing 1 native token for ", paymaster.target);
        await paymaster.deposit({value: ethers.parseEther("1")});
        console.log("staking 1 native token");
        await paymaster.addStake(86400, {value: ethers.parseEther("0.05")});
    });
