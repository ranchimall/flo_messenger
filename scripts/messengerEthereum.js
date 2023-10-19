(function (EXPORTS) { //floEthereum v1.0.1a
    /* FLO Ethereum Operators */
    /* Make sure you added Taproot, Keccak, FLO and BTC Libraries before */
    'use strict';
    const floEthereum = EXPORTS;

// onlyEvenY is usually false. It is needed to be true only when taproot private keys are input
const ethAddressFromPrivateKey = floEthereum.ethAddressFromPrivateKey = function(privateKey, onlyEvenY = false){
    var t1,t1_x,t1_y,t2,t3,t4;
    t1 = bitjs.newPubkey(privateKey);
    t1_x = t1.slice(2, 66); t1_y = t1.slice(-64);
           
    t2 = t1_x.toString(16) + t1_y.toString(16);
    t3 = keccak.keccak_256(Crypto.util.hexToBytes(t2));
    t4 = keccak.extractLast20Bytes(t3);
    return "0x" + t4;
}

const ethAddressFromCompressedPublicKey = floEthereum.ethAddressFromCompressedPublicKey = function(compressedPublicKey){
    var t1,t2,t3,t4;
    t1 = coinjs.compressedToUncompressed(compressedPublicKey);
    t2 = t1.slice(2);
    t3 = keccak.keccak_256(Crypto.util.hexToBytes(t2));
    t4 = keccak.extractLast20Bytes(t3);
    return "0x" + t4; 
}

const ethAddressFromUncompressedPublicKey = floEthereum.ethAddressFromUncompressedPublicKey = function(unCompressedPublicKey){
    var t1,t2,t3,t4;
    t1 = unCompressedPublicKey;
    t2 = t1.slice(2);
    t3 = keccak.keccak_256(Crypto.util.hexToBytes(t2));
    t4 = keccak.extractLast20Bytes(t3);
    return "0x" + t4; 
}    

})('object' === typeof module ? module.exports : window.floEthereum = {});
