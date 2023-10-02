import { expect } from "chai";
import { ethers, deployments } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import * as hre from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { TestHexlinkERC20, AirdropSimple__factory } from "../typechain-types";
import { SENDER_NAME_HASH, buildAccountExecData, callWithEntryPoint, deployErc20 } from "./testers";
import { epoch, getAirdrop, getHexlink, getEntryPoint, getAirdropPaymaster } from "../tasks/utils";
import { Contract } from "ethers";
import { deploySender } from "./account";

export async function deployAirdropSimple(token: string, validator: string) {
    const {deployer} = await ethers.getNamedSigners();
    const deployed = await hre.deployments.deploy("AirdropSimple", {
      from: deployer.address,
      args: [token, validator],
      log: true,
      autoMine: true,
    });
    return AirdropSimple__factory.connect(
      deployed.address, deployer
    );
}

describe("Airdrop", function() {
  let hexlink: Contract;
  let airdrop: Contract;
  let entrypoint: Contract;
  let erc20: TestHexlinkERC20;
  let deployer: HardhatEthersSigner;
  let validator: HardhatEthersSigner;

  beforeEach(async function() {
    const signers = await ethers.getNamedSigners();
    deployer = signers.deployer;
    validator = signers.validator;
    await deployments.fixture(["TEST"]);
    airdrop = await getAirdrop(hre);
    erc20 = await deployErc20();
    hexlink = await getHexlink(hre);
    entrypoint = await getEntryPoint(hre);
  });

  it("should create campaign", async function() {
    expect(await airdrop.getNextCampaign()).to.eq(0);
    const campaign = {
        token: await erc20.getAddress(),
        startAt: 0,
        endAt: epoch() + 3600, // now + 1 hour
        deposit: 10000,
        validator: validator.address,
        owner: deployer.address,
    };
    await erc20.approve(await airdrop.getAddress(), 10000);
    await expect(
        airdrop.createCampaign(campaign)
    ).to.emit(airdrop, "NewCampaign").withArgs(0, [
        campaign.token,
        campaign.startAt,
        campaign.endAt,
        campaign.deposit,
        campaign.validator,
        campaign.owner
    ]);
    expect(await airdrop.getNextCampaign()).to.eq(1);

    const c = await airdrop.getCampaign(0);
    expect(c.token).to.eq(campaign.token);
    expect(c.startAt).to.eq(campaign.startAt);
    expect(c.endAt).to.eq(campaign.endAt);
    expect(c.deposit).to.eq(campaign.deposit);
    expect(c.owner).to.eq(campaign.owner);
    expect(c.validator).to.eq(campaign.validator);
  });

  it("should deposit and withdraw", async function() {
    const {validator} = await ethers.getNamedSigners();
    expect(await airdrop.getNextCampaign()).to.eq(0);
    const campaign = {
        token: await erc20.getAddress(),
        startAt: 0,
        endAt: epoch() + 3600, // now + 1 hour
        deposit: 10000,
        owner: deployer.address,
        validator: validator.address,
    };
    await erc20.approve(await airdrop.getAddress(), 10000);
    await airdrop.createCampaign(campaign);
    expect(await erc20.balanceOf(await airdrop.getAddress())).to.eq(10000);

    await erc20.approve(await airdrop.getAddress(), 10000);
    await airdrop.deposit(0, 1000);
    expect((await airdrop.getCampaign(0)).deposit).to.eq(11000);
    expect(await erc20.balanceOf(await airdrop.getAddress())).to.eq(11000);

    await expect((await getAirdrop(hre, validator)).withdraw(0))
      .to.be.revertedWithCustomError(airdrop, "NotAuthorized");

    await expect(airdrop.withdraw(0))
      .to.be.revertedWithCustomError(airdrop, "CampaignNotEnded");

    // withdraw
    campaign.startAt = 0;
    campaign.endAt = epoch() - 3600;
    await erc20.approve(await airdrop.getAddress(), 10000);
    await airdrop.createCampaign(campaign);

    expect(await erc20.balanceOf(await airdrop.getAddress())).to.eq(21000);
    expect(await airdrop.getNextCampaign()).to.eq(2);
    expect((await airdrop.getCampaign(1)).deposit).to.eq(10000);

    await airdrop.withdraw(1);
    expect((await airdrop.getCampaign(1)).deposit).to.eq(0);
    expect(await erc20.balanceOf(await airdrop.getAddress())).to.eq(11000);
  });

  it("should self claim with hexlink account", async function() {
    const { tester } = await hre.getNamedAccounts();
    const sender = await deploySender(hexlink);
    const senderAddr = await sender.getAddress();
    const tx = await deployer.sendTransaction({
        to: senderAddr,
        value: ethers.parseEther("1.0")
    });
    await tx.wait();

    const campaign = {
        token: await erc20.getAddress(),
        startAt: 0,
        endAt: epoch() + 3600, // now + 1 hour
        deposit: 10000,
        owner: deployer.address,
        validator: validator.address,
    };
    await erc20.approve(await airdrop.getAddress(), 10000);
    await airdrop.createCampaign(campaign);

    const genSig = async (campaignId: number, amount: number = 100) => {
        const message = ethers.solidityPackedKeccak256(
            ["uint256", "address", "uint256", "address", "address", "uint256"],
            [
                hre.network.config.chainId,
                await airdrop.getAddress(),
                campaignId,
                senderAddr,
                tester,
                amount
            ]
        );
        return await validator.signMessage(ethers.getBytes(message));
    };
    await expect(
        airdrop.claim(0, senderAddr, tester, 100, await genSig(0))
    ).to.be.revertedWithCustomError(airdrop, "NotCalledFromClaimer");

    const claimData = async (campaignId: number, amount: number = 100) => {
        const claimData = airdrop.interface.encodeFunctionData(
            "claim",
            [campaignId, senderAddr, tester, amount, await genSig(campaignId)]
        );
        return await buildAccountExecData(
            await airdrop.getAddress(), 0, claimData);
    };

    let error = airdrop.interface.encodeErrorResult("CampaignNotExist", []);
    await expect(
        callWithEntryPoint(senderAddr, '0x', await claimData(1), entrypoint, deployer)
    ).to.emit(entrypoint, "UserOperationRevertReason")
    .withArgs(anyValue, anyValue, anyValue, error);

    error = airdrop.interface.encodeErrorResult("InsufficientDeposit", [10000, 10001]);
    await expect(
        callWithEntryPoint(senderAddr, '0x', await claimData(0, 10001), entrypoint, deployer)
    ).to.emit(entrypoint, "UserOperationRevertReason")
    .withArgs(anyValue, anyValue, anyValue, error);

    // claim
    await callWithEntryPoint(senderAddr, '0x', await claimData(0), entrypoint, deployer)
    expect(await erc20.balanceOf(tester)).to.eq(100);
    expect((await airdrop.getCampaign(0)).deposit).to.eq(9900);

    // reclaim
    error = airdrop.interface.encodeErrorResult("AlreadyClaimed", []);
    await expect(
        callWithEntryPoint(senderAddr, '0x', await claimData(0), entrypoint, deployer)
    ).to.emit(entrypoint, "UserOperationRevertReason")
    .withArgs(anyValue, anyValue, anyValue, error);

    // campaign not started
    campaign.startAt = epoch() + 3600;
    await erc20.approve(await airdrop.getAddress(), 10000);
    await airdrop.createCampaign(campaign);
    expect(await airdrop.getNextCampaign()).to.eq(2);
    error = airdrop.interface.encodeErrorResult("CampaignNotStarted", []);
    await expect(
        callWithEntryPoint(senderAddr, '0x', await claimData(1), entrypoint, deployer)
    ).to.emit(entrypoint, "UserOperationRevertReason")
    .withArgs(anyValue, anyValue, anyValue, error);

    // campaign already ended
    campaign.startAt = 0;
    campaign.endAt = epoch() - 3600;
    await erc20.approve(await airdrop.getAddress(), 10000);
    await airdrop.createCampaign(campaign);
    expect(await airdrop.getNextCampaign()).to.eq(3);
    error = airdrop.interface.encodeErrorResult("CampaignAlreadyEnded", []);
    await expect(
        callWithEntryPoint(senderAddr, '0x', await claimData(2), entrypoint, deployer)
    ).to.emit(entrypoint, "UserOperationRevertReason")
    .withArgs(anyValue, anyValue, anyValue, error);
  });

  it("should self claim with eoa", async function() {
    const { tester } = await hre.getNamedAccounts();
    const campaign = {
        token: await erc20.getAddress(),
        startAt: 0,
        endAt: epoch() + 3600, // now + 1 hour
        deposit: 10000,
        validator: validator.address,
        owner: deployer.address,
    };
    await erc20.approve(await airdrop.getAddress(), 10000);
    await airdrop.createCampaign(campaign);

    const genSig = async (campaignId: number, amount: number = 100) => {
        const message = ethers.solidityPackedKeccak256(
            ["uint256", "address", "uint256", "address", "address", "uint256"],
            [
                hre.network.config.chainId,
                await airdrop.getAddress(),
                campaignId,
                deployer.address,
                tester,
                amount
            ]
        );
        return await validator.signMessage(ethers.getBytes(message));
    };
    await airdrop.claim(0, deployer.address, tester, 100, await genSig(0)); 
  });

  it("test airdrop simple", async function() {
    const { tester } = await hre.getNamedAccounts();
    const airdrop = await deployAirdropSimple(
        await erc20.getAddress(), validator.address);
    await erc20.transfer(await airdrop.getAddress(), 10000);

    expect(await airdrop.paused()).to.eq(false);
    await airdrop.pause();
    expect(await airdrop.paused()).to.eq(true);

    const genSig = async (amount: number = 100) => {
        const message = ethers.solidityPackedKeccak256(
            ["uint256", "address", "address", "address", "uint256"],
            [
                hre.network.config.chainId,
                await airdrop.getAddress(),
                deployer.address,
                tester,
                amount
            ]
        );
        return await validator.signMessage(ethers.getBytes(message));
    };
    await expect(
        airdrop.claim(deployer.address, tester, 100, await genSig())
    ).to.be.revertedWith("Pausable: paused");

    await airdrop.unpause();
    expect(await airdrop.paused()).to.eq(false);

    await airdrop.claim(deployer.address, tester, 100, await genSig());
    expect(await erc20.balanceOf(tester)).to.eq(100);

    await airdrop.withdraw(tester, 9900);
    expect(await erc20.balanceOf(tester)).to.eq(10000);
  });

  it("test airdrop paymaster", async function() {
    const paymaster = await getAirdropPaymaster(hre);
    const tx1 = await paymaster.deposit({value: ethers.parseEther("1.0")});
    await tx1.wait();

    const { tester } = await hre.getNamedAccounts();
    // deployer sender account
    const sender = await deploySender(hexlink);
    const senderAddr = await sender.getAddress();
    const tx2 = await deployer.sendTransaction({
        to: senderAddr,
        value: ethers.parseEther("1.0")
    });
    await tx2.wait();

    // create campaign
    const campaign = {
        token: await erc20.getAddress(),
        startAt: 0,
        endAt: epoch() + 3600, // now + 1 hour
        deposit: 10000,
        owner: deployer.address,
        validator: validator.address,
    };
    await erc20.approve(await airdrop.getAddress(), 10000);
    await airdrop.createCampaign(campaign);

    // generate claim proof
    const genSig = async (campaignId: number, amount: number = 100) => {
        const message = ethers.solidityPackedKeccak256(
            ["uint256", "address", "uint256", "address", "address", "uint256"],
            [
                hre.network.config.chainId,
                await airdrop.getAddress(),
                campaignId,
                senderAddr,
                tester,
                amount
            ]
        );
        return await validator.signMessage(ethers.getBytes(message));
    };
    const claimData = async (campaignId: number, amount: number = 100) => {
        const claimData = airdrop.interface.encodeFunctionData(
            "claim",
            [campaignId, senderAddr, tester, amount, await genSig(campaignId)]
        );
        return await buildAccountExecData(
            await airdrop.getAddress(), 0, claimData);
    };
    const accountData = await claimData(0);
    const paymasterData = ethers.solidityPacked(
        ["address", "bytes32"],
        [await paymaster.getAddress(), SENDER_NAME_HASH]
    );
    await callWithEntryPoint(
        senderAddr, '0x', accountData, entrypoint, deployer, paymasterData);

    expect(await erc20.balanceOf(tester)).to.eq(100);
    expect((await airdrop.getCampaign(0)).deposit).to.eq(9900);
  });
});
