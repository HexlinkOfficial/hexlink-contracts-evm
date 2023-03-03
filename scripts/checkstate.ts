
import { ethers } from "hardhat";

async function main() {
    const erc721 : ethers.Contact = await ethers.getContractAt(
      "HexlinkErc721Impl", "0x6592915622D7EBaf3cB1da112F71Fc52a36616c3"
    );
    
    const deposit = await erc721.gasSponsorship();
    console.log(deposit.toString());
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});