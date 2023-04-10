import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import {ethers, BigNumber} from "ethers";

task("claim", "claim red packet")
    .setAction(async function (args, hre: HardhatRuntimeEnvironment) {
        const { deployer } = await hre.ethers.getNamedSigners();
        const contract = await hre.ethers.getContractAt(
            "HappyRedPacketImpl",
            "0xad7346eBfCd605A9528fCdFfe868e5d4772A3362",
        );
        const user = "0x871d84EE4cbc8e2e51EC43aa4a85cc88c1627AA2";
        const redpacketId = "0x9204fa94bc9c9354b4891a4937b98adbf96c7bb429f28641ce5c3db72c7fa1ed";
        const packet = {
            token: '0x11fE4B6AE13d2a6055C8D9cF65c55bac32B5d844',
            balance: BigNumber.from('1000000000000000000'),
            split: 1,
            salt: '0x02231f10bf7f7309536908a57720eace78a5666a73c49a34cbcbc95ff99ea056',
            validator: '0xEF2e3F91209F88A3143e36Be10D52502162426B3',
            mode: 2,
        };
        const message = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ["bytes32", "address"],
                [redpacketId, user]
            )
        );

        const validator = new ethers.Wallet(process.env.HARDHAT_VALIDATOR!);
        const signature = await validator.signMessage(ethers.utils.arrayify(message));
        const callData = contract.interface.encodeFunctionData("claim", [{
            creator: "0x871d84EE4cbc8e2e51EC43aa4a85cc88c1627AA2",
            packet,
            claimer: "0x871d84EE4cbc8e2e51EC43aa4a85cc88c1627AA2",
            signature
        }]);
        const op = {
            to: contract.address,
            value: "0x0",
            callGasLimit: "0x0",
            callData,
        }
        const hexlink = await hre.run("hexlink", {});
        const tx = await hexlink.connect(deployer).process([op]);
        console.log("tx hash = ", tx.hash);
        const receipt = await tx.wait();
        console.log("tx receipt = ", receipt);
    });