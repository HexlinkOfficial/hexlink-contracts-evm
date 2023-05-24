import * as hre from "hardhat";
import { hash, getHexlink } from "../tasks/utils";

async function main() {
    const hexlink = await getHexlink(hre);
    const initCode = "0x2b85ba3872d1ef37d68f2d3f6e3493fbc601480836e27e6d5d113b896a16717cb8e96d07";
    console.log(hexlink.interface.decodeFunctionData('deploy', initCode));
    await hexlink.deploy(hash("test123@example.com"));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });