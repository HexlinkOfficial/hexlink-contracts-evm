import { expect } from "chai";
import { ethers, deployments, artifacts, run } from "hardhat";
import { Contract } from "ethers";
import { getHexlinkSwap, setGasPrice } from "./swap";

const namehash = function(name: string) : string {
  return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(name));
}
const senderName = "mailto:sender@gmail.com";
const sender = namehash(senderName);
const receiverName = "mailto:receiver@gmail.com";
const receiver = namehash(receiverName);

const getContract = async function(name: string) : Promise<Contract> {
  const deployment = await deployments.get(name);
  return await ethers.getContractAt(name, deployment.address);
};

const genERC20TransferTxData = async function(
  receiver: string,
  amount: Number
): Promise<string> {
  const artifact = await artifacts.readArtifact("ERC20");
  const iface = new ethers.utils.Interface(artifact.abi);
  return iface.encodeFunctionData(
      "transfer",
      [receiver, amount]
  );
}

const deployAccount = async function(
  name: string,
  accountDeployer: Contract
) : Promise<Contract> {
  const { deployer } = await ethers.getNamedSigners();
  const artifact = await deployments.getArtifact("AccountSimple");
  const iface = new ethers.utils.Interface(artifact.abi);
  const data = iface.encodeFunctionData(
    "init", [deployer.address, []]
  );
  const accountAddr = await accountDeployer.addressOfName(name);
  await expect(
    accountDeployer.deploy(name, data)
  ).to.emit(accountDeployer, "Deploy").withArgs(accountAddr);
  return await ethers.getContractAt(
    "AccountSimple",
    accountAddr
  );
}

describe("Hexlink Account", function() {
  beforeEach(async function() {
    const { deployer } = await ethers.getNamedSigners();
    await deployments.fixture(["HEXL"]);
    const proxy = await getContract("AccountProxy");
    // deploy test deployer
    await deployments.deploy("TestAccountDeployer", {
      from: deployer.address,
      args: [proxy.address],
      log: true,
      autoMine: true,
    });
    // deploy erc4337 implementation 
    await deployments.deploy("AccountERC4337", {
      from: deployer.address,
      args: [],
      log: true,
      autoMine: true,
    });
  });

  it("Should with correct beacon and implementation", async function() {
    const impl = await getContract("AccountSimple");
    const beacon = await getContract("AccountBeacon");
    const proxy = await getContract("AccountProxy");

    expect(await beacon.implementation()).to.eq(impl.address);
    expect(await proxy.beacon()).to.eq(beacon.address);
  
    const impl2 = await getContract("AccountERC4337");
    const data = beacon.interface.encodeFunctionData(
      "upgradeTo", [impl2.address]
    );
    await run("admin_schedule_and_exec", {target: beacon.address, data})
    expect(await beacon.implementation()).to.eq(impl2.address);
    expect(await proxy.beacon()).to.eq(beacon.address);
  });

  it("Should transfer erc20 successfully", async function() {
    const { deployer } = await ethers.getNamedSigners();
    const accountDeployer = await getContract("TestAccountDeployer");
    const accountAddr = await accountDeployer.addressOfName(sender);

    // receive tokens before account created
    const token = await getContract("HexlinkToken");
    await expect(
      token.connect(deployer).transfer(accountAddr, 5000)
    ).to.emit(token, "Transfer")
      .withArgs(deployer.address, accountAddr, 5000);
    expect(await token.balanceOf(accountAddr)).to.eq(5000);

    // deploy account contract
    const account = await deployAccount(sender, accountDeployer);

    // receive tokens after account created
    await expect(
      token.connect(deployer).transfer(account.address, 5000)
    ).to.emit(token, "Transfer")
      .withArgs(deployer.address, account.address, 5000);
    expect(await token.balanceOf(account.address)).to.eq(10000);

    // send tokens
    expect(await token.balanceOf(account.address)).to.eq(10000);
    const receiverAddr = await accountDeployer.addressOfName(receiver);
    await account.connect(deployer).exec({
      to: token.address,
      value: 0,
      callData: await genERC20TransferTxData(
        receiverAddr, 5000
      ),
      callGasLimit: 0
    });
    expect(await token.balanceOf(account.address)).to.eq(5000);
    expect(await token.balanceOf(receiverAddr)).to.eq(5000);
  });

  it("Should transfer eth successfully", async function() {
    const { deployer } = await ethers.getNamedSigners();
    const accountDeployer = await getContract("TestAccountDeployer");
    const senderAddr = await accountDeployer.addressOfName(sender);

    // receive eth before account created
    const tx1 = await deployer.sendTransaction({
      to: senderAddr,
      value: ethers.utils.parseEther("1.0")
    });
    await tx1.wait();
    expect(
      await ethers.provider.getBalance(senderAddr)
    ).to.eq(ethers.utils.parseEther("1.0"));

    // create new account contract
    const account = await deployAccount(sender, accountDeployer);

    // receive eth after account created
    const tx2 = await deployer.sendTransaction({
      to: senderAddr,
      value: ethers.utils.parseEther("1.0")
    });
    await tx2.wait();
    expect(
      await ethers.provider.getBalance(senderAddr)
    ).to.eq(ethers.utils.parseEther("2.0"));

    // send ETH
    const receiverAddr = await accountDeployer.addressOfName(receiver);
    await account.connect(deployer).exec({
      to: receiverAddr,
      value: ethers.utils.parseEther("0.5"),
      callData: [],
      callGasLimit: 0
    });
    expect(
      await ethers.provider.getBalance(receiverAddr)
    ).to.eq(ethers.utils.parseEther("0.5").toHexString());
  });

  it("Should hold and transfer ERC1155 successfully", async function() {
    const { deployer } = await ethers.getNamedSigners();
    const accountDeployer = await getContract("TestAccountDeployer");
    const senderAddr = await accountDeployer.addressOfName(sender);
    await deployments.deploy("TestHexlinkERC1155", {
      from: deployer.address,
      log: true,
      autoMine: true,
    });
    const erc1155 = await getContract("TestHexlinkERC1155");

    // receive erc1155 before account created
    await expect(
      erc1155.connect(deployer).safeTransferFrom(
        deployer.address, senderAddr, 1, 10, []
      )
    ).to.emit(erc1155, "TransferSingle")
      .withArgs(deployer.address, deployer.address, senderAddr, 1, 10);
    expect(await erc1155.balanceOf(senderAddr, 1)).to.eq(10);

    // create new account contract
    const account = await deployAccount(sender, accountDeployer);

    // receive erc1155 after account created
    await expect(
      erc1155.connect(deployer).safeTransferFrom(
        deployer.address, senderAddr, 1, 10, []
      )
    ).to.emit(erc1155, "TransferSingle")
      .withArgs(deployer.address, deployer.address, senderAddr, 1, 10);
    expect(await erc1155.balanceOf(senderAddr, 1)).to.eq(20);
  
    // send erc1155
    const artifact = await deployments.getArtifact("TestHexlinkERC1155");
    const iface = new ethers.utils.Interface(artifact.abi);
    const txData = iface.encodeFunctionData(
        "safeTransferFrom",
        [senderAddr, deployer.address, 1, 10, []]
    );
    await run("exec", {
      account: account.address,
      to: erc1155.address,
      callData: txData
    });
    expect(await erc1155.balanceOf(senderAddr, 1)).to.eq(10);
  });

  it("Should pay gas with gas refund with eth", async function() {
    const accountDeployer = await getContract("TestAccountDeployer");
    const account = await deployAccount(sender, accountDeployer);
    const token = await getContract("HexlinkToken");
    const { deployer, validator, tester } = await ethers.getNamedSigners();

    // send token to account
    await token.connect(deployer).transfer(account.address, 5000);
    // send eth to account
    let balance = ethers.utils.parseEther("1.0");
    await deployer.sendTransaction({
      to: account.address,
      value: balance
    });

    // token transfer with validateAndCall
    const receiverAddr = await accountDeployer.addressOfName(receiver);
    const data = account.interface.encodeFunctionData(
        "execBatch",
        [
          [
            {
              to: token.address,
              value: 0,
              callData: token.interface.encodeFunctionData(
                "transfer",
                [tester.address, 100]
              ),
              callGasLimit: 0
            }
          ]
        ]
    );
    const nonce = await account.nonce();
    const gas = {
      swapper: ethers.constants.AddressZero,
      token: ethers.constants.AddressZero,
      receiver: receiverAddr,
      baseGas: 0,
    };
    const requestId = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["bytes", "uint256", "tuple(address, address, address, uint256)"],
        [data, nonce, [gas.swapper, gas.token, gas.receiver, gas.baseGas]]
      ));
    const signature = await deployer.signMessage(
      ethers.utils.arrayify(requestId)
    );

    const tx = await account.connect(
      validator
    ).validateAndCallWithGasRefund(data, nonce, gas, signature);
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed;
    const e = receipt.events.find((x: any) => x.event === "GasPaid");
    console.log("real gas cost = " + gasCost.toNumber());
    console.log("gas refund = " + e.args.payment.toNumber());
    // check eth balance
    expect(
      await ethers.provider.getBalance(receiverAddr)
    ).to.eq(e.args.payment);
  });

  it("Should pay gas with gas refund with hexlink token", async function() {
    const accountDeployer = await getContract("TestAccountDeployer");
    const account = await deployAccount(sender, accountDeployer);
    const token = await getContract("HexlinkToken");
    const { deployer, validator, tester } = await ethers.getNamedSigners();

    // send token to account
    await token.connect(deployer).transfer(account.address, 500000);
  
    // token transfer with validateAndCall
    const receiverAddr = await accountDeployer.addressOfName(receiver);
    const data = account.interface.encodeFunctionData(
        "execBatch",
        [
          [
            {
              to: token.address,
              value: 0,
              callData: token.interface.encodeFunctionData(
                "transfer",
                [tester.address, 100]
              ),
              callGasLimit: 0
            }
          ]
        ]
    );
    const nonce = await account.nonce();
    const swap = await getHexlinkSwap();
    await setGasPrice(token, swap);
    await swap.connect(deployer).deposit({
      value: ethers.utils.parseEther("1.0")
    });
    const gas = {
      swapper: swap.address,
      token: token.address,
      receiver: receiverAddr,
      baseGas: 0,
    };
    const requestId = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["bytes", "uint256", "tuple(address, address, address, uint256)"],
        [data, nonce, [gas.swapper, gas.token, gas.receiver, gas.baseGas]]
      ));
    const signature = await deployer.signMessage(
      ethers.utils.arrayify(requestId)
    );

    const tx = await account.connect(
      validator
    ).validateAndCallWithGasRefund(data, nonce, gas, signature);
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed;
    const e = receipt.events.find((x: any) => x.event === "GasPaid");
    console.log("real gas cost = "  + gasCost.toNumber());
    console.log("gas refund = " + e.args.payment.toNumber());
    // check eth balance
    expect(
      await ethers.provider.getBalance(receiverAddr)
    ).to.eq(e.args.payment);
  });
});
