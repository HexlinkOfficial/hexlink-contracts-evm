
import { ethers } from "hardhat";

async function main() {
    const swap : ethers.Contact = await ethers.getContractAt(
      "HexlinkSwapImpl", "0x2C3831f813507A429d93ecE671BcB6cF139fd186"
    );
    const dai = await ethers.getContractAt(
        "ERC20", "0x11fe4b6ae13d2a6055c8d9cf65c55bac32b5d844"
    );
    console.log((await swap.owner()));
    console.log((await swap.priceOf(dai.address)).toString());
    console.log((await ethers.provider.getBalance(swap.address)).toString());

    const { deployer } = await ethers.getNamedSigners();
    console.log(deployer.address);
    const { maxFeePerGas } = await ethers.provider.getFeeData();
    console.log(maxFeePerGas.toString());
    const tx1 = await dai.connect(deployer).approve(
        swap.address,
        "9269704657200000001",
    );
    console.log(tx1.hash);

    const tx2 = await swap.connect(deployer).swapAndCall(
        "0x11fe4b6ae13d2a6055c8d9cf65c55bac32b5d844",
        "9269704657200000001",
        "0x990023c63dde016537240fEd07915525369FC62B",
        "0x6a761202",
    );
    console.log(tx2.hash);
    console.log((await ethers.provider.getBalance(
        "0x990023c63dde016537240fEd07915525369FC62B"
    )).toString());
    const receipt = await ethers.provider.getTransactionReceipt(tx2.hash);
    const events = receipt.logs.filter(
        l => l.address == swap.address
    ).map(l => swap.interface.parseLog(l));
    console.log(events[0]);
    console.log(events[0].args.amountIn.toString());
    console.log(events[0].args.amountOut.toString());
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});