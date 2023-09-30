import { expect } from "chai";
import { ethers, deployments } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import * as hre from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { TestHexlinkERC20 } from "../typechain-types";
import { SENDER_NAME_HASH, buildAccountExecData, callWithEntryPoint, deployErc20 } from "./testers";
import { epoch, getAirdrop, getHexlink, getEntryPoint } from "../tasks/utils";
import { Contract } from "ethers";
import { deploySender } from "./account";

describe("Airdrop", function() {
  let hexlink: Contract;
  let airdrop: Contract;
  let entrypoint: Contract;
  let erc20: TestHexlinkERC20;
  let deployer: HardhatEthersSigner;

  beforeEach(async function() {
    const signers = await ethers.getNamedSigners();
    deployer = signers.deployer;
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
        campaign.owner
    ]);
    expect(await airdrop.getNextCampaign()).to.eq(1);

    const c = await airdrop.getCampaign(0);
    expect(c.token).to.eq(campaign.token);
    expect(c.startAt).to.eq(campaign.startAt);
    expect(c.endAt).to.eq(campaign.endAt);
    expect(c.deposit).to.eq(campaign.deposit);
    expect(c.owner).to.eq(campaign.owner);
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

  it("should self claim one", async function() {
    const { validator } = await hre.getNamedAccounts();
    const campaign = {
        token: await erc20.getAddress(),
        startAt: 0,
        endAt: epoch() + 3600, // now + 1 hour
        deposit: 10000,
        owner: deployer.address,
    };
    await erc20.approve(await airdrop.getAddress(), 10000);
    await airdrop.createCampaign(campaign);

    const genSig = async (campaignId: number, amount: number = 100) => {
        const message = ethers.solidityPackedKeccak256(
            ["uint256", "address", "uint256", "bytes32", "address", "uint256"],
            [
                hre.network.config.chainId,
                await airdrop.getAddress(),
                campaignId,
                SENDER_NAME_HASH,
                validator,
                amount
            ]
        );
        return await deployer.signMessage(ethers.getBytes(message));
    };
    await expect(
        airdrop.claim(0, SENDER_NAME_HASH, validator, 100, await genSig(0))
    ).to.be.revertedWithCustomError(airdrop, "NotCalledFromClaimer");

    const sender = await deploySender(hexlink);
    const tx = await deployer.sendTransaction({
        to: sender,
        value: ethers.parseEther("1.0")
    });
    await tx.wait();
    const senderAddr = await sender.getAddress();
    const claimData = async (campaignId: number, amount: number = 100) => {
        const claimData = airdrop.interface.encodeFunctionData(
            "claim",
            [campaignId, SENDER_NAME_HASH, validator, amount, await genSig(campaignId)]
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

    // deposit and claim
    await callWithEntryPoint(senderAddr, '0x', await claimData(0), entrypoint, deployer)
    expect(await erc20.balanceOf(validator)).to.eq(100);
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
});
