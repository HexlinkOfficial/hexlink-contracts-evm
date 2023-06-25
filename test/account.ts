import { expect } from "chai";
import * as hre from "hardhat";
import { ethers, deployments, getNamedAccounts, run } from "hardhat";
import { Contract, BigNumberish } from "ethers";
import { EMAIL_NAME_TYPE, SENDER_NAME_HASH, RECEIVER_NAME_HASH} from "./testers";
import { UserOperationStruct } from '@account-abstraction/contracts'
import { resolveProperties } from 'ethers/lib/utils'
import { genInitCode } from "./hexlink";

const deploySender = async (hexlink: Contract) : Promise<Contract> => {
  const accountAddr = await hexlink.ownedAccount(EMAIL_NAME_TYPE, SENDER_NAME_HASH);
  await expect(
    hexlink.deploy(EMAIL_NAME_TYPE, SENDER_NAME_HASH)
  ).to.emit(hexlink, "Deployed").withArgs(
    EMAIL_NAME_TYPE, SENDER_NAME_HASH, accountAddr
  );
  return await ethers.getContractAt("Account", accountAddr);
}

export const buildAccountExecData = async (
  target: string,
  value?: BigNumberish,
  data?: string
) => {
  const artifact = await hre.artifacts.readArtifact("Account");
  const iface = new ethers.utils.Interface(artifact.abi);
  return iface.encodeFunctionData("exec", [target, value ?? 0, data ?? []]);
}

const getNonce = async (sender: string) => {
  const account = await ethers.getContractAt("Account", sender);
  if (await ethers.provider.getCode(sender) === "0x") {
    return 0;
  }
  return account.getNonce();
}

export const callWithEntryPoint = async (
  sender: string,
  initCode: string | [],
  callData: string | [],
  entrypoint: Contract
) => {
  const {deployer, validator} = await hre.ethers.getNamedSigners();
  const fee = await ethers.provider.getFeeData();
  const userOp: UserOperationStruct = {
    sender,
    nonce: await getNonce(sender),
    initCode,
    callData,
    callGasLimit: 500000,
    verificationGasLimit: 2000000,
    preVerificationGas: 0,
    maxFeePerGas: fee.maxFeePerGas?.toNumber() ?? 0,
    maxPriorityFeePerGas: fee.maxPriorityFeePerGas?.toNumber() ?? 0,
    paymasterAndData: [],
    signature: [],
  };
  const op = await resolveProperties(userOp);
  const opHash = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      [
        'address',
        'uint256',
        'bytes32',
        'bytes32',
        'uint256',
        'uint256',
        'uint256',
        'uint256',
        'uint256',
        'bytes32',
      ],
      [
        op.sender,
        op.nonce,
        ethers.utils.keccak256(op.initCode),
        ethers.utils.keccak256(op.callData),
        op.callGasLimit,
        op.verificationGasLimit,
        op.preVerificationGas,
        op.maxFeePerGas,
        op.maxPriorityFeePerGas,
        ethers.utils.keccak256(op.paymasterAndData)
      ]
    )
  );
  const chainId = await hre.getChainId();
  const userOpHash = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "address", "uint256"],
      [opHash, entrypoint.address, chainId]
    )
  );
  const message = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "bytes32", "bytes32"],
      [EMAIL_NAME_TYPE, SENDER_NAME_HASH, userOpHash]
    )
  );
  const signature = await validator.signMessage(
    ethers.utils.arrayify(message)
  );
  const signed = { ...userOp, signature, };
  await entrypoint.handleOps([signed], deployer.address);
}

describe("Hexlink Account", function () {
  let hexlink: Contract;
  let entrypoint: Contract;
  let sender: string;
  let receiver: string;

  beforeEach(async function () {
    await deployments.fixture(["TEST"]);
    const hexlinkProxy = await run("deployHexlinkProxy", {});
    hexlink = await ethers.getContractAt("Hexlink", hexlinkProxy);
    sender = await hexlink.ownedAccount(EMAIL_NAME_TYPE, SENDER_NAME_HASH);
    receiver = await hexlink.ownedAccount(EMAIL_NAME_TYPE, RECEIVER_NAME_HASH);
    entrypoint = await ethers.getContractAt(
      "EntryPoint",
      (await deployments.get("EntryPoint")).address
    );
    // deposit eth before account created
    const { deployer } = await hre.ethers.getNamedSigners();
    await deployer.sendTransaction({
      to: sender,
      value: ethers.utils.parseEther("1.0")
    });
  });

  it("Should upgrade successfully", async function () {
    const { deployer } = await getNamedAccounts();
    let account = await deploySender(hexlink);
    const impl2 = await deployments.deploy(
      "AccountV2ForTest",
      {
        from: deployer,
        args: [await account.entryPoint()]
      }
    );

    const accountProxy = await ethers.getContractAt(
      "HexlinkERC1967Proxy",
      account.address
    );
    await expect(
      accountProxy.initProxy(impl2.address, [])
    ).to.be.reverted;

    await expect(
      account.upgradeTo(ethers.constants.AddressZero)
    ).to.be.reverted;

    await expect(
      account.upgradeTo(impl2.address)
    ).to.be.reverted;

    const callData = account.interface.encodeFunctionData(
      "upgradeTo", [impl2.address]);
    await callWithEntryPoint(sender, [], callData, entrypoint);
    expect(await account.implementation()).to.eq(impl2.address);
  });

  it("Should transfer erc20 successfully", async function () {
    const { deployer } = await ethers.getNamedSigners();

    // receive tokens before account created
    const token = await ethers.getContractAt(
      "HexlinkToken",
      (await deployments.get("HexlinkToken")).address
    );
    await expect(
      token.connect(deployer).transfer(sender, 5000)
    ).to.emit(token, "Transfer")
      .withArgs(deployer.address, sender, 5000);
    expect(await token.balanceOf(sender)).to.eq(5000);

    // deploy sender
    const initCode = await genInitCode(hexlink);
    await callWithEntryPoint(sender, initCode, [], entrypoint);

    // receive tokens after account created
    await expect(
      token.connect(deployer).transfer(sender, 5000)
    ).to.emit(token, "Transfer")
      .withArgs(deployer.address, sender, 5000);
    expect(await token.balanceOf(sender)).to.eq(10000);

    const erc20Data = token.interface.encodeFunctionData(
      "transfer",
      [receiver, 5000]
    );
    const callData = await buildAccountExecData(token.address, 0, erc20Data);
    await callWithEntryPoint(sender, [], callData, entrypoint);
    expect(await token.balanceOf(sender)).to.eq(5000);
    expect(await token.balanceOf(receiver)).to.eq(5000);
  });

  it("Should transfer eth successfully", async function () {
    const { deployer } = await ethers.getNamedSigners();

    // receive eth before account created
    const tx1 = await deployer.sendTransaction({
      to: sender,
      value: ethers.utils.parseEther("1.0")
    });
    await tx1.wait();
    expect(
      await ethers.provider.getBalance(sender)
    ).to.eq(ethers.utils.parseEther("2.0"));

    // deploy sender
    const initCode = await genInitCode(hexlink);
    await callWithEntryPoint(sender, initCode, [], entrypoint);

    // receive eth after account created
    const tx2 = await deployer.sendTransaction({
      to: sender,
      value: ethers.utils.parseEther("1.0")
    });
    await tx2.wait();
    expect(
      await ethers.provider.getBalance(sender)
    ).to.gt(ethers.utils.parseEther("2.5"));

    // send ETH
    const callData = await buildAccountExecData(
      receiver, ethers.utils.parseEther("0.5")
    );
    await callWithEntryPoint(sender, [], callData, entrypoint);
    expect(
      await ethers.provider.getBalance(receiver)
    ).to.eq(ethers.utils.parseEther("0.5").toHexString());
  });

  it("Should hold and transfer ERC1155 successfully", async function () {
    const { deployer } = await ethers.getNamedSigners();
    const deployed = await deployments.deploy("TestHexlinkERC1155", {
      from: deployer.address,
      log: true,
      autoMine: true,
    });
    const erc1155 = await ethers.getContractAt(
      "TestHexlinkERC1155",
      deployed.address
    );

    // receive erc1155 before account created
    await expect(
      erc1155.connect(deployer).safeTransferFrom(
        deployer.address, sender, 1, 10, []
      )
    ).to.emit(erc1155, "TransferSingle")
      .withArgs(deployer.address, deployer.address, sender, 1, 10);
    expect(await erc1155.balanceOf(sender, 1)).to.eq(10);

    // deploy sender
    const initCode = await genInitCode(hexlink);
    await callWithEntryPoint(sender, initCode, [], entrypoint);

    // receive erc1155 after account created
    await expect(
      erc1155.connect(deployer).safeTransferFrom(
        deployer.address, sender, 1, 10, []
      )
    ).to.emit(erc1155, "TransferSingle")
      .withArgs(deployer.address, deployer.address, sender, 1, 10);
    expect(await erc1155.balanceOf(sender, 1)).to.eq(20);

    // send erc1155
    const erc1155Data = erc1155.interface.encodeFunctionData(
      "safeTransferFrom",
      [sender, receiver, 1, 10, []]
    );
    const callData = await buildAccountExecData(erc1155.address, 0, erc1155Data);
    await callWithEntryPoint(sender, [], callData, entrypoint);
    expect(await erc1155.balanceOf(sender, 1)).to.eq(10);
    expect(await erc1155.balanceOf(receiver, 1)).to.eq(10);
  });
});
