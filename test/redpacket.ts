import { expect } from "chai";
import { ethers, deployments, artifacts, run, network } from "hardhat";
import { Contract } from "ethers";
import { getHexlinkSwap, getHexlinkToken, setGasPrice } from "./swap";

const namehash = function(name: string) : string {
    return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(name));
}
const senderName = "mailto:sender@gmail.com";
const sender = namehash(senderName);

async function iface(contract: string) {
    const artifact = await artifacts.readArtifact(contract);
    return new ethers.utils.Interface(artifact.abi);
}

async function getHexlink() : Promise<Contract> {
    const deployment = await deployments.get("Hexlink");
    return await ethers.getContractAt("HexlinkUpgradeable", deployment.address);
}

async function getRedPacket() : Promise<Contract> {
    const deployment = await deployments.get("HappyRedPacket");
    return await ethers.getContractAt("HappyRedPacketImpl", deployment.address);
}

function genRedPacketId(contract: string, creator: string, packet: any) : string {
    const redPacketType = "tuple(address,address,bytes32,uint256,address,uint32,uint8,bool)";
    return ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
            ["uint256", "address", redPacketType],
            [
                network.config.chainId,
                contract,
                [
                    packet.creator,
                    packet.token,
                    packet.salt,
                    packet.balance,
                    packet.validator,
                    packet.split,
                    packet.mode,
                    packet.sponsorGas
                ]
            ]
        )
    );
}

describe("Hexlink Redpacket", function() {
    beforeEach(async function() {
      await deployments.fixture(["HEXL"]);
    });

    it("erc20 as packet token and eth as gas token with deploy", async function() {
        const { deployer, validator, tester } = await ethers.getNamedSigners();

        const token = await getHexlinkToken();
        const hexlink = await getHexlink();
        const redPacket = await getRedPacket();
        const accountAddr = await hexlink.addressOfName(sender);

        const packet = {
            creator: accountAddr,
            token: token.address,
            salt: ethers.constants.HashZero,
            balance: 10000,
            validator: validator.address,
            split: 10,
            mode: 2,
            sponsorGas: true,
        };
        // deposit some token to tester
        await token.connect(deployer).transfer(tester.address, 1000000);
        await token.connect(tester).transfer(accountAddr, packet.balance);
        const value = ethers.utils.parseEther("1.0");

        // build op to deposit gas sponsorship
        const redPacketIface = await iface("HappyRedPacketImpl");
        const id = genRedPacketId(redPacket.address, accountAddr, packet);
        const deposit = ethers.utils.parseEther("0.5");
        const op0 = {
            to: redPacket.address,
            value: deposit,
            callData: redPacketIface.encodeFunctionData(
                "deposit", [id]
            ),
            callGasLimit: 0 // no limit
        };

        // build op to approve red packet for packet token
        const op1 = {
            to: token.address,
            value: 0,
            callData: token.interface.encodeFunctionData(
                "approve", [redPacket.address, packet.balance]
            ),
            callGasLimit: 0 // no limit
        };

        // build op to create red packet
        const op2 = {
            to: redPacket.address,
            value: 0,
            callData: redPacketIface.encodeFunctionData(
                "create", [packet]
            ),
            callGasLimit: 0 // no limit
        };

        // build txData for execBatch
        const accountIface = await iface("AccountSimple");
        const opsData = accountIface.encodeFunctionData(
            "execBatch",
            [[op0, op1, op2]]
        );
        const initData = accountIface.encodeFunctionData("init", [
            tester.address, opsData
        ]);

        // build op to init account
        const authProof = await run("build_deploy_auth_proof", {
            name: sender,
            identityType: "twitter.com",
            authType: "oauth",
            data: initData
        });

        const data = hexlink.interface.encodeFunctionData(
            "deploy",
            [sender, initData, authProof],
        );

        const tx = await hexlink.connect(tester).process([{
            to: accountAddr,
            value,
            callData: [],
            callGasLimit: 0
        }, {
            to: hexlink.address,
            value: 0,
            callData: data,
            callGasLimit: 0
        }], {value});
        const receipt = await tx.wait();
        const gasCost = receipt.gasUsed;
        console.log("real gas cost = "  + gasCost.toNumber());

        expect(
            await ethers.provider.getBalance(accountAddr)
        ).to.eq(value.sub(deposit));

        const hash = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "address"],
                [id, tester.address, ethers.constants.AddressZero]
            )
        );
        const signature = await validator.signMessage(
            ethers.utils.arrayify(hash)
        );
        expect(await redPacket.getClaimedCount(id, tester.address)).to.eq(0);
        const tx2 = await redPacket.connect(deployer).claim(
            packet,
            tester.address,
            ethers.constants.AddressZero,
            signature
        );
        await tx2.wait();
        expect(await redPacket.getClaimedCount(id, tester.address)).to.eq(1);
    });

    it("erc20 as packet token and eth as gas token", async function() {
        const { deployer, validator, tester } = await ethers.getNamedSigners();

        const hexlinkToken = await getHexlinkToken();
        const hexlink = await getHexlink();
        const redPacket = await getRedPacket();
        const swap = await getHexlinkSwap();
        await setGasPrice(hexlinkToken, swap);
        const accountAddr = await hexlink.addressOfName(sender);

        // deploy
        const accountIface = await iface("AccountSimple");
        const initData = accountIface.encodeFunctionData("init", [
            tester.address, []
        ]);
        const authProof = await run("build_deploy_auth_proof", {
            name: sender,
            identityType: "twitter.com",
            authType: "oauth",
            data: initData
        });
        await hexlink.connect(tester).deploy(sender, initData, authProof);
        const account = await ethers.getContractAt("AccountSimple", accountAddr);

        // create redpacket
        const packet = {
            creator: accountAddr,
            token: hexlinkToken.address,
            salt: ethers.constants.HashZero,
            balance: 10000,
            validator: validator.address,
            split: 10,
            mode: 2,
            sponsorGas: true,
        };
        // deposit some token to account str
        const token = await ethers.getContractAt("IERC20", hexlinkToken.address);
        await token.connect(deployer).transfer(accountAddr, packet.balance);
        await tester.sendTransaction({to: accountAddr, value: ethers.utils.parseEther("1.0")});

        // build op to deposit gas sponsorship
        const id = genRedPacketId(redPacket.address, accountAddr, packet);
        const redPacketIface = await iface("HappyRedPacketImpl");
        const deposit = ethers.utils.parseEther("0.5");
        const op0 = {
            to: redPacket.address,
            value: deposit,
            callData: redPacketIface.encodeFunctionData(
                "deposit", [id]
            ),
            callGasLimit: 0 // no limit
        };

        // build op to approve red packet for packet token
        const op1 = {
            to: hexlinkToken.address,
            value: 0,
            callData: token.interface.encodeFunctionData(
                "approve", [redPacket.address, packet.balance]
            ),
            callGasLimit: 0 // no limit
        };

        // build op to create red packet
        const op2 = {
            to: redPacket.address,
            value: 0,
            callData: redPacketIface.encodeFunctionData(
                "create", [packet]
            ),
            callGasLimit: 0 // no limit
        };

        // build txData for execBatch
        const opsData = accountIface.encodeFunctionData(
            "execBatch",
            [[op0, op1, op2]]
        );
        const gas = {
            swapper: swap.address,
            token: ethers.constants.AddressZero,
            receiver: tester.address,
            baseGas: 0,
        };
        const message = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes", "uint256", "tuple(address, address, address, uint256)"],
                [opsData, 0, [gas.swapper, gas.token, gas.receiver, gas.baseGas]]
            )
        );
        const signature = await tester.signMessage(ethers.utils.arrayify(message));
        const nonce = await account.nonce();
        const tx = await account.connect(deployer).validateAndCallWithGasRefund(
            opsData, nonce, gas, signature
        );
        const receipt = await tx.wait();
        const event = receipt.events.find((e: any) => e.event === "GasPaid");
        console.log("gas payment = "  + event.args.payment.toString());
        console.log("real gas price = "  + receipt.effectiveGasPrice.toNumber());
        console.log("real gas cost = "  + receipt.gasUsed.toNumber());
        console.log("expected payment = "  + receipt.gasUsed.mul(receipt.effectiveGasPrice).toString());

        const hash = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "address"],
                [id, tester.address, ethers.constants.AddressZero]
            )
        );
        const sig = await validator.signMessage(
            ethers.utils.arrayify(hash)
        );
        expect(await redPacket.getClaimedCount(id, tester.address)).to.eq(0);
        const tx2 = await redPacket.connect(deployer).claim(
            packet,
            tester.address,
            ethers.constants.AddressZero,
            sig,
        );
        await tx2.wait();
        expect(await redPacket.getClaimedCount(id, tester.address)).to.eq(1);
    });

    it("erc20 as gas token", async function() {
        const { deployer, validator, tester } = await ethers.getNamedSigners();

        const hexlink = await getHexlink();
        const accountAddr = await hexlink.addressOfName(sender);
        const token = await getHexlinkToken();
        const redPacket = await getRedPacket();

        const swap = await getHexlinkSwap();
        await setGasPrice(token, swap);
        await swap.connect(deployer).deposit({value: ethers.utils.parseEther("1.0")});

        // deploy
        const accountIface = await iface("AccountSimple");
        const initData = accountIface.encodeFunctionData("init", [
            tester.address, []
        ]);
        const authProof = await run("build_deploy_auth_proof", {
            name: sender,
            identityType: "twitter.com",
            authType: "oauth",
            data: initData
        });
        await hexlink.connect(tester).deploy(sender, initData, authProof);
        const account = await ethers.getContractAt("AccountSimple", accountAddr);

        // create redpacket
        const packet = {
            creator: accountAddr,
            token: token.address,
            salt: ethers.constants.HashZero,
            balance: 10000,
            validator: validator.address,
            split: 10,
            mode: 2,
            sponsorGas: true,
        };
        // deposit some token to account str
        const amount = ethers.BigNumber.from(10).pow(18).mul(20);
        const totolTokenCost = amount.add(packet.balance).add(amount /* gas */);
        await token.connect(deployer).transfer(accountAddr, totolTokenCost);

        // build op to swap gas token to eth
        const op0 = {
            to: token.address,
            value: 0,
            callData: token.interface.encodeFunctionData(
                "approve", [swap.address, amount]
            ),
            callGasLimit: 0 // no limit
        };
        const id = genRedPacketId(redPacket.address, accountAddr, packet);
        const redPacketIface = await iface("HappyRedPacketImpl");
        const op1 = {
            to: swap.address,
            value: 0,
            callData: swap.interface.encodeFunctionData(
                "swapAndCall", [
                    token.address,
                    amount,
                    redPacket.address,
                    redPacketIface.encodeFunctionData(
                        "deposit", [id]
                    )
                ]
            ),
            callGasLimit: 0 // no limit
        };

        // build op to approve red packet for packet token
        const op2 = {
            to: token.address,
            value: 0,
            callData: token.interface.encodeFunctionData(
                "approve", [redPacket.address, packet.balance]
            ),
            callGasLimit: 0 // no limit
        };

        // build op to create red packet
        const op3 = {
            to: redPacket.address,
            value: 0,
            callData: redPacketIface.encodeFunctionData(
                "create", [packet]
            ),
            callGasLimit: 0 // no limit
        };

        // build txData for execBatch
        const opsData = accountIface.encodeFunctionData(
            "execBatch",
            [[op0, op1, op2, op3]]
        );
        const gas = {
            swapper: swap.address,
            receiver: tester.address,
            token: token.address,
            baseGas: "0",
        };
        const message = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes", "uint256", "tuple(address, address, address, uint256)"],
                [opsData, 0, [gas.swapper, gas.token, gas.receiver, gas.baseGas]]
            )
        );
        const signature = await tester.signMessage(ethers.utils.arrayify(message));
        const nonce = await account.nonce();
        const tx = await account.connect(deployer).validateAndCallWithGasRefund(
            opsData, nonce, gas, signature
        );
        const receipt = await tx.wait();
        const event = receipt.events.find((e: any) => e.event === "GasPaid");
        console.log("gas payment = "  + event.args.payment.toString());
        console.log("real gas price = "  + receipt.effectiveGasPrice.toNumber());
        console.log("real gas cost = "  + receipt.gasUsed.toNumber());
        console.log("expected payment = "  + receipt.gasUsed.mul(receipt.effectiveGasPrice).toString());
        const state = await redPacket.getPacket(id);
        expect(state.balance).to.eq(packet.balance);
        expect(state.split).to.eq(packet.split);

        const swapEvent = receipt.logs.filter(
            (log: any) => log.address === swap.address
        ).map((log: any) => swap.interface.parseLog(log)).find(
            (e: any) => e.name === "Swap"
        );
        expect(swapEvent.args.from).to.eq(accountAddr);
        expect(swapEvent.args.token).to.eq(token.address);
        expect(swapEvent.args.amountIn).to.eq(amount);
        expect(swapEvent.args.amountOut).to.eq(state.gasSponsorship);
        console.log(state.gasSponsorship.toString());

        // claim
        const hash = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address", "address"],
                [id, deployer.address, tester.address]
            )
        );
        const sig = await validator.signMessage(
            ethers.utils.arrayify(hash)
        );
        expect(await redPacket.getClaimedCount(id, tester.address)).to.eq(0);
        const tx2 = await redPacket.connect(deployer).claim(
            packet,
            deployer.address,
            tester.address,
            sig
        );
        const receipt2 = await tx2.wait();
        const e2 = receipt2.events.find((e: any) => e.event === "GasSponsorship");
        expect(e2.args.receiver).to.eq(gas.receiver);
        expect(await ethers.provider.getBalance(tester.address), e2.args.payment);
        console.log("real gas price = "  + receipt2.effectiveGasPrice.toNumber());
        console.log("real gas cost = "  + receipt2.gasUsed.toNumber());
        console.log("real gas cost is " + receipt2.gasUsed.mul(receipt2.effectiveGasPrice).toString());
        console.log("gas sponsorship is " + e2.args.payment.toString());
        expect(await redPacket.getClaimedCount(id, deployer.address)).to.eq(1);
    });
});
