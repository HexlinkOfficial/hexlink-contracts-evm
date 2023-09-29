import { expect } from "chai";
import { ethers, deployments } from "hardhat";
import * as hre from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import {
    Airdrop__factory,
    Airdrop,
    TestHexlinkERC20
} from "../typechain-types";
import { deployErc20 } from "./testers";
import { epoch } from "../tasks/utils";

async function getAirdrop(deployer: HardhatEthersSigner) {
  const deployed = await hre.deployments.get("AirdropProxy");
  return Airdrop__factory.connect(deployed.address, deployer);
}

describe("Hexlink", function() {
  let airdrop: Airdrop;
  let erc20: TestHexlinkERC20;
  let deployer: HardhatEthersSigner;

  beforeEach(async function() {
    const signers = await ethers.getNamedSigners();
    deployer = signers.deployer;
    await deployments.fixture(["TEST"]);
    airdrop = await getAirdrop(deployer);
    erc20 = await deployErc20();
  });

  it("should create campaign", async function() {
    expect(await airdrop.getNextCampaign()).to.eq(0);
    const campaign = {
        token: await erc20.getAddress(),
        startAt: 0,
        endAt: epoch() + 3600, // now + 1 hour
        amount: 100,
        owner: deployer.address,
    };
    await expect(
        airdrop.createCampaign(campaign)
    ).to.emit(airdrop, "NewCampaign").withArgs(0, [
        campaign.token,
        campaign.startAt,
        campaign.endAt,
        campaign.amount,
        campaign.owner
    ]);
    expect(await airdrop.getNextCampaign()).to.eq(1);

    const c = await airdrop.getCampaign(0);
    expect(c.token).to.eq(campaign.token);
    expect(c.startAt).to.eq(campaign.startAt);
    expect(c.endAt).to.eq(campaign.endAt);
    expect(c.amount).to.eq(campaign.amount);
    expect(c.owner).to.eq(campaign.owner);
  });

  it("should claim one", async function() {
    const { validator } = await hre.getNamedAccounts();
    const campaign = {
        token: await erc20.getAddress(),
        startAt: 0,
        endAt: epoch() + 3600, // now + 1 hour
        amount: 100,
        owner: deployer.address,
    };
    await airdrop.createCampaign(campaign);

    await expect(
        airdrop.claimOne(1, validator)
    ).to.be.revertedWithCustomError(airdrop, "CampaignNotExist");

    await expect(
        airdrop.claimOne(0, validator)
    ).to.be.revertedWithCustomError(airdrop, "InSufficientBalance");

    // deposit and claim
    await erc20.transfer(await airdrop.getAddress(), 10000);
    expect(await erc20.balanceOf(await airdrop.getAddress())).to.eq(10000);
    await airdrop.claimOne(0, validator);
    expect(await erc20.balanceOf(validator)).to.eq(100);

    // reclaim
    await expect(
        airdrop.claimOne(0, validator)
    ).to.be.revertedWithCustomError(airdrop, "AlreadyClaimed");

    // campaign not started
    campaign.startAt = epoch() + 3600;
    await airdrop.createCampaign(campaign);
    expect(await airdrop.getNextCampaign()).to.eq(2);
    await expect(
        airdrop.claimOne(1, validator)
    ).to.be.revertedWithCustomError(airdrop, "CampaignNotStarted");

    // campaign already ended
    campaign.startAt = 0;
    campaign.endAt = epoch() - 3600;
    await airdrop.createCampaign(campaign);
    expect(await airdrop.getNextCampaign()).to.eq(3);
    await expect(
        airdrop.claimOne(2, validator)
    ).to.be.revertedWithCustomError(airdrop, "CampaignAlreadyEnded");
  });

  it("should self claim one", async function() {
    const { validator } = await hre.getNamedAccounts();
    const campaign = {
        token: await erc20.getAddress(),
        startAt: 0,
        endAt: epoch() + 3600, // now + 1 hour
        amount: 100,
        owner: deployer.address,
    };
    await airdrop.createCampaign(campaign);

    const genSig = async (campaignId: number) => {
        const message = ethers.solidityPackedKeccak256(
            ["uint256", "address"],
            [campaignId, validator]
        );
        return await deployer.signMessage(ethers.getBytes(message));
    };

    await expect(
        airdrop.selfClaim(1, validator, await genSig(1))
    ).to.be.revertedWithCustomError(airdrop, "CampaignNotExist");

    await expect(
        airdrop.selfClaim(0, validator, await genSig(0))
    ).to.be.revertedWithCustomError(airdrop, "InSufficientBalance");

    // deposit and claim
    await erc20.transfer(await airdrop.getAddress(), 10000);
    expect(await erc20.balanceOf(await airdrop.getAddress())).to.eq(10000);
    await airdrop.selfClaim(0, validator, await genSig(0));
    expect(await erc20.balanceOf(validator)).to.eq(100);

    // reclaim
    await expect(
        airdrop.selfClaim(0, validator, await genSig(0))
    ).to.be.revertedWithCustomError(airdrop, "AlreadyClaimed");

    // campaign not started
    campaign.startAt = epoch() + 3600;
    await airdrop.createCampaign(campaign);
    expect(await airdrop.getNextCampaign()).to.eq(2);
    await expect(
        airdrop.selfClaim(1, validator, await genSig(1))
    ).to.be.revertedWithCustomError(airdrop, "CampaignNotStarted");

    // campaign already ended
    campaign.startAt = 0;
    campaign.endAt = epoch() - 3600;
    await airdrop.createCampaign(campaign);
    expect(await airdrop.getNextCampaign()).to.eq(3);
    await expect(
        airdrop.selfClaim(2, validator, await genSig(2))
    ).to.be.revertedWithCustomError(airdrop, "CampaignAlreadyEnded");
  });

  it("should claim batch", async function() {
    const { validator, tester } = await hre.getNamedAccounts();
    const campaign = {
        token: await erc20.getAddress(),
        startAt: 0,
        endAt: epoch() + 3600, // now + 1 hour
        amount: 100,
        owner: deployer.address,
    };
    await airdrop.createCampaign(campaign);

    const receipts = [deployer.address, validator, tester];
    await expect(
        airdrop.claimBatch(1, receipts)
    ).to.be.revertedWithCustomError(airdrop, "CampaignNotExist");

    // transfer 400 which should not cover 3
    await erc20.transfer(await airdrop.getAddress(), 200);
    await expect(
        airdrop.claimBatch(0, receipts)
    ).to.be.revertedWithCustomError(airdrop, "InSufficientBalance");

    // deposit and claim
    await erc20.transfer(await airdrop.getAddress(), 1000);
    await airdrop.claimBatch(0, receipts);
    expect(await erc20.balanceOf(validator)).to.eq(100);
    expect(await erc20.balanceOf(tester)).to.eq(100);

    // reclaim
    await expect(
        airdrop.claimBatch(0, receipts)
    ).to.be.revertedWithCustomError(airdrop, "AlreadyClaimed");

    // campaign not started
    campaign.startAt = epoch() + 3600;
    await airdrop.createCampaign(campaign);
    expect(await airdrop.getNextCampaign()).to.eq(2);
    await expect(
        airdrop.claimBatch(1, receipts)
    ).to.be.revertedWithCustomError(airdrop, "CampaignNotStarted");

    // campaign already ended
    campaign.startAt = 0;
    campaign.endAt = epoch() - 3600;
    await airdrop.createCampaign(campaign);
    expect(await airdrop.getNextCampaign()).to.eq(3);
    await expect(
        airdrop.claimBatch(2, receipts)
    ).to.be.revertedWithCustomError(airdrop, "CampaignAlreadyEnded");
  });
});