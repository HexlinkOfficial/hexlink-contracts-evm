import { hash, nameHash } from "../tasks/utils";

export const senderName = {
    schema: hash("mailto"),
    domain: hash("gmail.com"),
    handle: hash("sender"),
};
  
export const receiverName = {
    schema: hash("mailto"),
    domain: hash("gmail.com"),
    handle: hash("receiver"),
};

export const senderNameHash = nameHash(senderName);
export const receiverNameHash = nameHash(receiverName);