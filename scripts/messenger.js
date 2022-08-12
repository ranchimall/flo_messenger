(function() {
    const messenger = window.messenger = {};

    const user = {
        get id() {
            return floDapps.user.id
        },
        get public() {
            return floDapps.user.public
        }
    }

    const expiredKeys = {};

    const UI = {
        group: (d, e) => console.log(d, e),
        pipeline: (d, e) => console.log(d, e),
        direct: (d, e) => console.log(d, e),
        chats: (c) => console.log(c),
        mails: (m) => console.log(m),
        marked: (r) => console.log(r)
    };
    messenger.renderUI = {};
    Object.defineProperties(messenger.renderUI, {
        chats: {
            set: ui_fn => UI.chats = ui_fn
        },
        directChat: {
            set: ui_fn => UI.direct = ui_fn
        },
        groupChat: {
            set: ui_fn => UI.group = ui_fn
        },
        pipeline: {
            set: ui_fn => UI.pipeline = ui_fn
        },
        mails: {
            set: ui_fn => UI.mails = ui_fn
        },
        marked: {
            set: ui_fn => UI.marked = ui_fn
        },
    });

    const _loaded = {};
    Object.defineProperties(messenger, {
        chats: {
            get: () => _loaded.chats
        },
        groups: {
            get: () => _loaded.groups
        },
        pipeline: {
            get: () => _loaded.pipeline
        },
        blocked: {
            get: () => _loaded.blocked
        },
        marked: {
            get: () => _loaded.marked
        }
    });

    var directConnID, groupConnID = {},
        pipeConnID = {};
    messenger.conn = {};
    Object.defineProperties(messenger.conn, {
        direct: {
            get: () => directConnID
        },
        group: {
            get: () => Object.assign({}, groupConnID),
            // value: g_id => groupConnID[g_id]
        }
    });

    function sendRaw(message, recipient, type, encrypt = null, comment = undefined) {
        return new Promise((resolve, reject) => {
            if (!floCrypto.validateAddr(recipient))
                return reject("Invalid Recipient floID");

            if ([true, null].includes(encrypt) && recipient in floGlobals.pubKeys)
                message = floCrypto.encryptData(message, floGlobals.pubKeys[recipient])
            else if (encrypt === true)
                return reject("recipient's pubKey not found")
            let options = {
                receiverID: recipient,
            }
            if (comment)
                options.comment = comment
            floCloudAPI.sendApplicationData(message, type, options)
                .then(result => resolve(result))
                .catch(error => reject(error))
        })
    }

    function encrypt(value, key = _loaded.appendix.AESKey) {
        return Crypto.AES.encrypt(value, key)
    }

    function decrypt(value, key = _loaded.appendix.AESKey) {
        return Crypto.AES.decrypt(value, key)
    }

    function addMark(key, mark) {
        return new Promise((resolve, reject) => {
            compactIDB.readData("marked", key).then(result => {
                if (!result)
                    result = [mark];
                else if (!result.includes(mark))
                    result.push(mark);
                else
                    return resolve("Mark already exist");
                compactIDB.writeData("marked", result, key)
                    .then(result => resolve(result))
                    .catch(error => reject(error))
            }).catch(error => reject(error))
        })
    }

    function removeMark(key, mark) {
        return new Promise((resolve, reject) => {
            compactIDB.readData("marked", key).then(result => {
                if (!result || !result.includes(mark))
                    return resolve("Mark doesnot exist")
                else {
                    result.splice(result.indexOf(mark), 1); //remove the mark from the list of marks
                    compactIDB.writeData("marked", result, key)
                        .then(result => resolve("Mark removed"))
                        .catch(error => reject(error))
                }
            }).catch(error => reject(error))
        })
    }

    const initUserDB = function() {
        return new Promise((resolve, reject) => {
            var obj = {
                messages: {},
                mails: {},
                marked: {},
                chats: {},
                groups: {},
                gkeys: {},
                blocked: {},
                pipeline: {},
                flodata: {},
                appendix: {},
                userSettings: {}
            }
            let user_db = `${floGlobals.application}_${user.id}`;
            compactIDB.initDB(user_db, obj).then(result => {
                console.info(result)
                compactIDB.setDefaultDB(user_db);
                resolve("Messenger UserDB Initated Successfully")
            }).catch(error => reject(error));
        })
    }

    messenger.blockUser = function(floID) {
        return new Promise((resolve, reject) => {
            if (_loaded.blocked.has(floID))
                return resolve("User is already blocked");
            compactIDB.addData("blocked", true, floID).then(result => {
                _loaded.blocked.add(floID);
                resolve("Blocked User: " + floID);
            }).catch(error => reject(error))
        })
    }

    messenger.unblockUser = function(floID) {
        return new Promise((resolve, reject) => {
            if (!_loaded.blocked.has(floID))
                return resolve("User is not blocked");
            compactIDB.removeData("blocked", floID).then(result => {
                _loaded.blocked.delete(floID);
                resolve("Unblocked User: " + floID);
            }).catch(error => reject(error))
        })
    }

    messenger.sendMessage = function(message, receiver) {
        return new Promise((resolve, reject) => {
            sendRaw(message, receiver, "MESSAGE").then(result => {
                let vc = result.vectorClock;
                let data = {
                    floID: receiver,
                    time: result.time,
                    category: 'sent',
                    message: encrypt(message)
                }
                _loaded.chats[receiver] = parseInt(vc)
                compactIDB.writeData("chats", parseInt(vc), receiver)
                compactIDB.addData("messages", {
                    ...data
                }, `${receiver}|${vc}`)
                data.message = message;
                resolve({
                    [vc]: data
                });
            }).catch(error => reject(error))
        })
    }

    messenger.sendMail = function(subject, content, recipients, prev = null) {
        return new Promise((resolve, reject) => {
            if (!Array.isArray(recipients))
                recipients = [recipients]
            let mail = {
                subject: subject,
                content: content,
                ref: Date.now() + floCrypto.randString(8, true),
                prev: prev
            }
            let promises = recipients.map(r => sendRaw(JSON.stringify(mail), r, "MAIL"))
            Promise.allSettled(promises).then(results => {
                mail.time = Date.now();
                mail.from = user.id
                mail.to = []
                results.forEach(r => {
                    if (r.status === "fulfilled")
                        mail.to.push(r.value.receiverID)
                });
                if (mail.to.length === 0)
                    return reject(results)
                mail.content = encrypt(content)
                compactIDB.addData("mails", {
                    ...mail
                }, mail.ref)
                mail.content = content
                resolve({
                    [mail.ref]: mail
                });
            })
        })
    }

    const processData = {};
    processData.direct = function() {
        return (unparsed, newInbox) => {
            //store the pubKey if not stored already
            floDapps.storePubKey(unparsed.senderID, unparsed.pubKey);
            if (_loaded.blocked.has(unparsed.senderID) && unparsed.type !== "REVOKE_KEY")
                throw "blocked-user";
            if (unparsed.message instanceof Object && "secret" in unparsed.message)
                unparsed.message = floDapps.user.decrypt(unparsed.message);
            switch (unparsed.type) {
                case "MESSAGE": { //process as message
                    let dm = {
                        time: unparsed.time,
                        floID: unparsed.senderID,
                        category: "received",
                        message: encrypt(unparsed.message)
                    }
                    compactIDB.addData("messages", {
                        ...dm
                    }, `${dm.floID}|${vc}`)
                    _loaded.chats[dm.floID] = parseInt(vc)
                    compactIDB.writeData("chats", parseInt(vc), dm.floID)
                    dm.message = unparsed.message;
                    newInbox.messages[vc] = dm;
                    addMark(dm.floID, "unread");
                    break;
                }
                case "MAIL": { //process as mail
                    let data = JSON.parse(unparsed.message);
                    let mail = {
                        time: unparsed.time,
                        from: unparsed.senderID,
                        to: [unparsed.receiverID],
                        subject: data.subject,
                        content: encrypt(data.content),
                        ref: data.ref,
                        prev: data.prev
                    }
                    compactIDB.addData("mails", {
                        ...mail
                    }, mail.ref);
                    mail.content = data.content;
                    newInbox.mails[mail.ref] = mail;
                    addMark(mail.ref, "unread");
                    break;
                }
                case "CREATE_GROUP": { //process create group
                    let groupInfo = JSON.parse(unparsed.message);
                    let h = ["groupID", "created", "admin"].map(x => groupInfo[x]).join('|')
                    if (groupInfo.admin === unparsed.senderID &&
                        floCrypto.verifySign(h, groupInfo.hash, groupInfo.pubKey) &&
                        floCrypto.getFloID(groupInfo.pubKey) === groupInfo.groupID) {
                        let eKey = groupInfo.eKey
                        groupInfo.eKey = encrypt(eKey)
                        compactIDB.writeData("groups", {
                            ...groupInfo
                        }, groupInfo.groupID)
                        groupInfo.eKey = eKey
                        _loaded.groups[groupInfo.groupID] = groupInfo
                        requestGroupInbox(groupInfo.groupID)
                        newInbox.newgroups.push(groupInfo.groupID)
                    }
                    break;
                }
                case "REVOKE_KEY": { //revoke group key
                    let r = JSON.parse(unparsed.message);
                    let groupInfo = _loaded.groups[r.groupID]
                    if (unparsed.senderID === groupInfo.admin) {
                        if (typeof expiredKeys[r.groupID] !== "object")
                            expiredKeys[r.groupID] = {}
                        expiredKeys[r.groupID][vc] = groupInfo.eKey
                        let eKey = r.newKey
                        groupInfo.eKey = encrypt(eKey);
                        compactIDB.writeData("groups", {
                            ...groupInfo
                        }, groupInfo.groupID)
                        groupInfo.eKey = eKey
                        newInbox.keyrevoke.push(groupInfo.groupID)
                    }
                }
            }
        }
    }

    function requestDirectInbox() {
        if (directConnID) { //close existing request connection (if any)
            floCloudAPI.closeRequest(directConnID);
            directConnID = undefined;
        }
        const parseData = processData.direct();
        let callbackFn = function(dataSet, error) {
            if (error)
                return console.error(error)
            let newInbox = {
                messages: {},
                mails: {},
                newgroups: [],
                keyrevoke: []
            }
            for (let vc in dataSet) {
                try {
                    parseData(dataSet[vc], newInbox);
                } catch (error) {
                    //if (error !== "blocked-user")
                    console.log(error);
                } finally {
                    if (_loaded.appendix.lastReceived < vc)
                        _loaded.appendix.lastReceived = vc;
                }
            }
            compactIDB.writeData("appendix", _loaded.appendix.lastReceived, "lastReceived");
            console.debug(newInbox);
            UI.direct(newInbox)
        }
        floCloudAPI.requestApplicationData(null, {
                receiverID: user.id,
                lowerVectorClock: _loaded.appendix.lastReceived + 1,
                callback: callbackFn
            }).then(conn_id => directConnID = conn_id)
            .catch(error => console.error("request-direct:", error));
    }

    messenger.getMail = function(mailRef) {
        return new Promise((resolve, reject) => {
            compactIDB.readData("mails", mailRef).then(mail => {
                mail.content = decrypt(mail.content)
                resolve(mail)
            }).catch(error => reject(error))
        });
    }

    const getChatOrder = messenger.getChatOrder = function(separate = false) {
        let result;
        if (separate) {
            result = {};
            result.direct = Object.keys(_loaded.chats).map(a => [_loaded.chats[a], a])
                .sort((a, b) => b[0] - a[0]).map(a => a[1]);
            result.group = Object.keys(_loaded.groups).map(a => [parseInt(_loaded.appendix[`lastReceived_${a}`]), a])
                .sort((a, b) => b[0] - a[0]).map(a => a[1]);
        } else {
            result = Object.keys(_loaded.chats).map(a => [_loaded.chats[a], a])
                .concat(Object.keys(_loaded.groups).map(a => [parseInt(_loaded.appendix[`lastReceived_${a}`]), a]))
                .sort((a, b) => b[0] - a[0]).map(a => a[1])
        }
        return result;
    }

    messenger.storeContact = function(floID, name) {
        return floDapps.storeContact(floID, name)
    }

    const loadDataFromIDB = function(defaultList = true) {
        return new Promise((resolve, reject) => {
            if (defaultList)
                dataList = ["mails", "marked", "groups", "pipeline", "chats", "blocked", "appendix"]
            else
                dataList = ["messages", "mails", "marked", "chats", "groups", "gkeys", "pipeline", "blocked", "appendix"]
            let promises = []
            for (var i = 0; i < dataList.length; i++)
                promises[i] = compactIDB.readAllData(dataList[i])
            Promise.all(promises).then(results => {
                let data = {}
                for (var i = 0; i < dataList.length; i++)
                    data[dataList[i]] = results[i]
                data.appendix.lastReceived = data.appendix.lastReceived || '0';
                if (data.appendix.AESKey) {
                    try {
                        let AESKey = floDapps.user.decrypt(data.appendix.AESKey);
                        data.appendix.AESKey = AESKey;
                        if (dataList.includes("messages"))
                            for (let m in data.messages)
                                if (data.messages[m].message)
                                    data.messages[m].message = decrypt(data.messages[m].message, AESKey);
                        if (dataList.includes("mails"))
                            for (let m in data.mails)
                                data.mails[m].content = decrypt(data.mails[m].content, AESKey);
                        if (dataList.includes("groups"))
                            for (let g in data.groups)
                                data.groups[g].eKey = decrypt(data.groups[g].eKey, AESKey);
                        if (dataList.includes("gkeys"))
                            for (let k in data.gkeys)
                                data.gkeys[k] = decrypt(data.gkeys[k], AESKey);
                        if (dataList.includes("pipeline"))
                            for (let p in data.pipeline)
                                data.pipeline[p].eKey = decrypt(data.pipeline[p].eKey, AESKey);
                        resolve(data)
                    } catch (error) {
                        console.error(error)
                        reject("Corrupted AES Key");
                    }
                } else {
                    if (Object.keys(data.mails).length)
                        return reject("AES Key not Found")
                    let AESKey = floCrypto.randString(32, false);
                    let encryptedKey = floCrypto.encryptData(AESKey, user.public);
                    compactIDB.addData("appendix", encryptedKey, "AESKey").then(result => {
                        data.appendix.AESKey = AESKey;
                        resolve(data);
                    }).catch(error => reject("Unable to Generate AES Key"))
                }
            }).catch(error => reject(error))
        })
    }

    messenger.addMark = function(key, mark) {
        if (_loaded.marked.hasOwnProperty(key) && !_loaded.marked[key].includes(mark))
            _loaded.marked[key].push(mark)
        return addMark(key, mark)
    }

    messenger.removeMark = function(key, mark) {
        if (_loaded.marked.hasOwnProperty(key))
            _loaded.marked[key] = _loaded.marked[key].filter(v => v !== mark)
        return removeMark(key, mark)
    }

    messenger.addChat = function(chatID) {
        return new Promise((resolve, reject) => {
            compactIDB.addData("chats", 0, chatID)
                .then(result => resolve("Added chat"))
                .catch(error => reject(error))
        })
    }

    messenger.rmChat = function(chatID) {
        return new Promise((resolve, reject) => {
            compactIDB.removeData("chats", chatID)
                .then(result => resolve("Chat removed"))
                .catch(error => reject(error))
        })
    }

    messenger.clearChat = function(chatID) {
        return new Promise((resolve, reject) => {
            let options = {
                lowerKey: `${chatID}|`,
                upperKey: `${chatID}||`
            }
            compactIDB.searchData("messages", options).then(result => {
                let promises = []
                for (let i in result)
                    promises.push(compactIDB.removeData("messages", i))
                Promise.all(promises)
                    .then(result => resolve("Chat cleared"))
                    .catch(error => reject(error))
            }).catch(error => reject(error))
        })
    }

    messenger.getChat = function(chatID) {
        return new Promise((resolve, reject) => {
            let options = {
                lowerKey: `${chatID}|`,
                upperKey: `${chatID}||`
            }
            compactIDB.searchData("messages", options).then(result => {
                for (let i in result)
                    if (result[i].message)
                        result[i].message = decrypt(result[i].message)
                resolve(result)
            }).catch(error => reject(error))
        })
    }

    messenger.backupData = function() {
        return new Promise((resolve, reject) => {
            loadDataFromIDB(false).then(data => {
                delete data.appendix.AESKey;
                data.contacts = floGlobals.contacts;
                data.pubKeys = floGlobals.pubKeys;
                data = btoa(unescape(encodeURIComponent(JSON.stringify(data))))
                let blobData = {
                    floID: user.id,
                    pubKey: user.public,
                    data: floDapps.user.encipher(data),
                }
                blobData.sign = floDapps.sign(blobData.data);
                resolve(new Blob([JSON.stringify(blobData)], {
                    type: 'application/json'
                }));
            }).catch(error => reject(error))
        })
    }

    const parseBackup = messenger.parseBackup = function(blob) {
        return new Promise((resolve, reject) => {
            if (blob instanceof Blob || blob instanceof File) {
                let reader = new FileReader();
                reader.onload = evt => {
                    var blobData = JSON.parse(evt.target.result);
                    if (!floCrypto.verifySign(blobData.data, blobData.sign, blobData.pubKey))
                        reject("Corrupted Backup file: Signature verification failed");
                    else if (user.id !== blobData.floID || user.public !== blobData.pubKey)
                        reject("Invalid Backup file: Incorrect floID");
                    else {
                        try {
                            let data = floDapps.user.decipher(blobData.data);
                            try {
                                data = JSON.parse(decodeURIComponent(escape(atob(data))));
                                resolve(data)
                            } catch (e) {
                                reject("Corrupted Backup file: Parse failed");
                            }
                        } catch (e) {
                            reject("Corrupted Backup file: Decryption failed");
                        }
                    }
                }
                reader.readAsText(blob);
            } else
                reject("Backup is not a valid File (or) Blob")
        })
    }

    messenger.restoreData = function(arg) {
        return new Promise((resolve, reject) => {
            if (arg instanceof Blob || arg instanceof File)
                var parseData = parseBackup
            else
                var parseData = data => new Promise((res, rej) => res(data))
            parseData(arg).then(data => {
                for (let m in data.messages)
                    if (data.messages[m].message)
                        data.messages[m].message = encrypt(data.messages[m].message)
                for (let m in data.mails)
                    data.mails[m].content = encrypt(data.mails[m].content)
                for (let k in data.gkeys)
                    data.gkeys[k] = encrypt(data.gkeys[k])
                for (let g in data.groups)
                    data.groups[g].eKey = encrypt(data.groups[g].eKey)
                for (let p in data.pipeline)
                    data.pipeline[p].eKey = encrypt(data.pipeline[p].eKey)
                for (let c in data.chats)
                    if (data.chats[c] <= _loaded.chats[c])
                        delete data.chats[c]
                for (let l in data.appendix)
                    if (l.startsWith('lastReceived') && data.appendix[l] <= _loaded.appendix[l])
                        delete data.appendix[l]
                for (let c in data.contacts)
                    if (c in floGlobals.contacts)
                        delete data.contacts[c]
                for (let p in data.pubKeys)
                    if (p in floGlobals.pubKeys)
                        delete data.pubKeys[p]
                let promises = [];
                for (let obs in data) {
                    let writeFn;
                    switch (obs) {
                        case "contacts":
                            writeFn = (k, v) => floDapps.storeContact(k, v);
                            break;
                        case "pubKeys":
                            writeFn = (k, v) => floDapps.storePubKey(k, v);
                            break;
                        default:
                            writeFn = (k, v) => compactIDB.writeData(obs, v, k);
                            break;
                    }
                    for (let k in data[obs])
                        promises.push(writeFn(k, data[obs][k]));
                }

                Promise.all(promises)
                    .then(results => resolve("Restore Successful"))
                    .catch(error => reject("Restore Failed: Unable to write to IDB"))
            }).catch(error => reject(error))
        })
    }

    messenger.clearUserData = function() {
        return new Promise((resolve, reject) => {
            let promises = [
                compactIDB.deleteDB(),
                floDapps.clearCredentials()
            ]
            Promise.all(promises)
                .then(result => resolve("User Data cleared"))
                .catch(error => reject(error))
        })
    }

    //group feature

    messenger.createGroup = function(groupname, description = '') {
        return new Promise((resolve, reject) => {
            if (!groupname) return reject("Invalid Group Name")
            let id = floCrypto.generateNewID();
            let groupInfo = {
                groupID: id.floID,
                pubKey: id.pubKey,
                admin: user.id,
                name: groupname,
                description: description,
                created: Date.now(),
                members: [user.id]
            }
            let h = ["groupID", "created", "admin"].map(x => groupInfo[x]).join('|')
            groupInfo.hash = floCrypto.signData(h, id.privKey)
            let eKey = floCrypto.randString(16, false)
            groupInfo.eKey = encrypt(eKey)
            let p1 = compactIDB.addData("groups", groupInfo, id.floID)
            let p2 = compactIDB.addData("gkeys", encrypt(id.privKey), id.floID)
            Promise.all([p1, p2]).then(r => {
                groupInfo.eKey = eKey
                _loaded.groups[id.floID] = groupInfo;
                requestGroupInbox(id.floID)
                resolve(groupInfo)
            }).catch(e => reject(e))
        })
    }

    messenger.changeGroupName = function(groupID, name) {
        return new Promise((resolve, reject) => {
            let groupInfo = _loaded.groups[groupID]
            if (user.id !== groupInfo.admin)
                return reject("Access denied: Admin only!")
            let message = encrypt(name, groupInfo.eKey)
            sendRaw(message, groupID, "UP_NAME", false)
                .then(result => resolve('Name updated'))
                .catch(error => reject(error))
        })
    }

    messenger.changeGroupDescription = function(groupID, description) {
        return new Promise((resolve, reject) => {
            let groupInfo = _loaded.groups[groupID]
            if (user.id !== groupInfo.admin)
                return reject("Access denied: Admin only!")
            let message = encrypt(description, groupInfo.eKey)
            sendRaw(message, groupID, "UP_DESCRIPTION", false)
                .then(result => resolve('Description updated'))
                .catch(error => reject(error))
        })
    }

    messenger.addGroupMembers = function(groupID, newMem, note = undefined) {
        return new Promise((resolve, reject) => {
            if (!Array.isArray(newMem) && typeof newMem === "string")
                newMem = [newMem]
            //check for validity
            let imem1 = [],
                imem2 = []
            newMem.forEach(m =>
                !floCrypto.validateAddr(m) ? imem1.push(m) :
                m in floGlobals.pubKeys ? null : imem2.push(m)
            );
            if (imem1.length)
                return reject(`Invalid Members(floIDs): ${imem1}`)
            else if (imem2.length)
                return reject(`Invalid Members (pubKey not available): ${imem2}`)
            //send new newMem list to existing members
            let groupInfo = _loaded.groups[groupID]
            if (user.id !== groupInfo.admin)
                return reject("Access denied: Admin only!")
            let k = groupInfo.eKey;
            //send groupInfo to new newMem
            groupInfo = JSON.stringify(groupInfo)
            let promises = newMem.map(m => sendRaw(groupInfo, m, "CREATE_GROUP", true));
            Promise.allSettled(promises).then(results => {
                let success = [],
                    failed = [];
                for (let i in results)
                    if (results[i].status === "fulfilled")
                        success.push(newMem[i])
                else if (results[i].status === "rejected")
                    failed.push(newMem[i])
                let message = encrypt(success.join("|"), k)
                sendRaw(message, groupID, "ADD_MEMBERS", false, note)
                    .then(r => resolve(`Members added: ${success}`))
                    .catch(e => reject(e))
            })
        })
    }

    messenger.rmGroupMembers = function(groupID, rmMem, note = undefined) {
        return new Promise((resolve, reject) => {
            if (!Array.isArray(rmMem) && typeof rmMem === "string")
                rmMem = [rmMem]
            let groupInfo = _loaded.groups[groupID]
            let imem = rmMem.filter(m => !groupInfo.members.includes(m))
            if (imem.length)
                return reject(`Invalid members: ${imem}`)
            if (user.id !== groupInfo.admin)
                return reject("Access denied: Admin only!")
            let message = encrypt(rmMem.join("|"), groupInfo.eKey)
            let p1 = sendRaw(message, groupID, "RM_MEMBERS", false, note)
            groupInfo.members = groupInfo.members.filter(m => !rmMem.includes(m))
            let p2 = revokeKey(groupID)
            Promise.all([p1, p2])
                .then(r => resolve(`Members removed: ${rmMem}`))
                .catch(e => reject(e))
        })
    }

    const revokeKey = messenger.revokeKey = function(groupID) {
        return new Promise((resolve, reject) => {
            let groupInfo = _loaded.groups[groupID]
            if (user.id !== groupInfo.admin)
                return reject("Access denied: Admin only!")
            let newKey = floCrypto.randString(16, false);
            Promise.all(groupInfo.members.map(m => sendRaw(JSON.stringify({
                newKey,
                groupID
            }), m, "REVOKE_KEY", true))).then(result => {
                resolve("Group key revoked")
            }).catch(error => reject(error))
        })
    }

    messenger.sendGroupMessage = function(message, groupID) {
        return new Promise((resolve, reject) => {
            let k = _loaded.groups[groupID].eKey
            message = encrypt(message, k)
            sendRaw(message, groupID, "GROUP_MSG", false)
                .then(result => resolve(`${groupID}: ${message}`))
                .catch(error => reject(error))
        })
    }

    const disableGroup = messenger.disableGroup = function(groupID) {
        return new Promise((resolve, reject) => {
            if (!_loaded.groups[groupID])
                return reject("Group not found");
            let groupInfo = {
                ..._loaded.groups[groupID]
            };
            if (groupInfo.disabled)
                return resolve("Group already diabled");
            groupInfo.disabled = true;
            groupInfo.eKey = encrypt(groupInfo.eKey)
            compactIDB.writeData("groups", groupInfo, groupID).then(result => {
                floCloudAPI.closeRequest(groupConnID[groupID]);
                delete groupConnID[groupID];
                resolve("Group diabled");
            }).catch(error => reject(error))
        })
    }

    processData.group = function(groupID) {
        return (unparsed, newInbox) => {
            if (!_loaded.groups[groupID].members.includes(unparsed.senderID))
                return;
            //store the pubKey if not stored already
            floDapps.storePubKey(unparsed.senderID, unparsed.pubKey)
            let data = {
                time: unparsed.time,
                sender: unparsed.senderID,
                groupID: unparsed.receiverID
            }
            let k = _loaded.groups[groupID].eKey;
            if (expiredKeys[groupID]) {
                var ex = Object.keys(expiredKeys[groupID]).sort()
                while (ex.length && vc > ex[0]) ex.shift()
                if (ex.length)
                    k = expiredKeys[groupID][ex.shift()]
            }
            unparsed.message = decrypt(unparsed.message, k);
            var infoChange = false;
            if (unparsed.type === "GROUP_MSG")
                data.message = encrypt(unparsed.message);
            else if (data.sender === _loaded.groups[groupID].admin) {
                let groupInfo = _loaded.groups[groupID]
                data.admin = true;
                switch (unparsed.type) {
                    case "ADD_MEMBERS": {
                        data.newMembers = unparsed.message.split("|")
                        data.note = unparsed.comment
                        groupInfo.members = [...new Set(groupInfo.members.concat(data.newMembers))]
                        break;
                    }
                    case "UP_DESCRIPTION": {
                        data.description = unparsed.message;
                        groupInfo.description = data.description;
                        break;
                    }
                    case "RM_MEMBERS": {
                        data.rmMembers = unparsed.message.split("|")
                        data.note = unparsed.comment
                        groupInfo.members = groupInfo.members.filter(m => !data.rmMembers.includes(m))
                        if (data.rmMembers.includes(user.id)) {
                            disableGroup(groupID);
                            return;
                        }
                        break;
                    }
                    case "UP_NAME": {
                        data.name = unparsed.message
                        groupInfo.name = data.name;
                        break;
                    }
                }
                infoChange = true;
            }
            compactIDB.addData("messages", {
                ...data
            }, `${groupID}|${vc}`)
            if (data.message)
                data.message = decrypt(data.message);
            newInbox.messages[vc] = data;
            if (data.sender !== user.id)
                addMark(data.groupID, "unread");
            return infoChange;
        }
    }

    function requestGroupInbox(groupID) {
        if (groupConnID[groupID]) { //close existing request connection (if any)
            floCloudAPI.closeRequest(groupConnID[groupID]);
            delete groupConnID[groupID];
        }

        const parseData = processData.group(groupID);
        let callbackFn = function(dataSet, error) {
            if (error)
                return console.error(error)
            console.info(dataSet)
            let newInbox = {
                messages: {}
            }
            let infoChange = false;
            for (let vc in dataSet) {
                if (groupID !== dataSet[vc].receiverID)
                    continue;
                try {
                    infoChange = parseData(dataSet[vc], newInbox) || infoChange;
                    if (!_loaded.appendix[`lastReceived_${groupID}`] ||
                        _loaded.appendix[`lastReceived_${groupID}`] < vc)
                        _loaded.appendix[`lastReceived_${groupID}`] = vc;
                } catch (error) {
                    console.log(error)
                }
            }
            compactIDB.writeData("appendix", _loaded.appendix[`lastReceived_${groupID}`], `lastReceived_${groupID}`);
            if (infoChange) {
                let newInfo = Object.assign(_loaded.groups[groupID], {});
                newInfo.eKey = encrypt(newInfo.eKey)
                compactIDB.writeData("groups", newInfo, groupID)
            }
            console.debug(newInbox);
            UI.group(newInbox);
        }
        floCloudAPI.requestApplicationData(null, {
                receiverID: groupID,
                lowerVectorClock: _loaded.appendix[`lastReceived_${groupID}`] + 1,
                callback: callbackFn
            }).then(conn_id => groupConnID[groupID] = conn_id)
            .catch(error => console.error(`request-group(${groupID}):`, error))

    }

    //messenger startups
    messenger.init = function() {
        return new Promise((resolve, reject) => {
            initUserDB().then(result => {
                console.debug(result);
                loadDataFromIDB().then(data => {
                    console.debug(data);
                    //load data to memory
                    _loaded.appendix = data.appendix;
                    _loaded.groups = data.groups;
                    _loaded.pipeline = data.pipeline;
                    _loaded.chats = data.chats;
                    _loaded.marked = data.marked;
                    _loaded.blocked = new Set(Object.keys(data.blocked));
                    //call UI render functions
                    UI.chats(getChatOrder());
                    UI.mails(data.mails);
                    UI.marked(data.marked);
                    //request data from cloud
                    requestDirectInbox();
                    for (let g in data.groups)
                        if (data.groups[g].disabled !== true)
                            requestGroupInbox(g);
                    for (let p in data.pipeline)
                        if (data.pipeline[p].disabled !== true)
                            requestPipelineInbox(p, data.pipeline[p].model);
                    resolve("Messenger initiated");
                }).catch(error => reject(error));
            })
        })
    }

    messenger.loadDataFromBlockchain = function() {
        return new Promise((resolve, reject) => {
            let user_floID = floCrypto.toFloID(user.id);
            if (!user_floID)
                return reject("Not an valid address");
            let last_key = `${floGlobals.application}|${user_floID}`;
            compactIDB.readData("lastTx", last_key, floDapps.root).then(lastTx => {
                floBlockchainAPI.readData(user_floID, {
                    ignoreOld: lastTx,
                    pattern: floGlobals.application,
                    tx: true //need tx-time and txid for key construction
                }).then(result => {
                    for (var i = result.data.length - 1; i >= 0; i--) {
                        let tx = result.data[i],
                            content = JSON.parse(tx.data)[floGlobals.application];
                        if (!(content instanceof Object))
                            continue;
                        let key = (content.type ? content.type + "|" : "") + tx.txid.substr(0, 16);
                        compactIDB.writeData("flodata", {
                            time: tx.time,
                            txid: tx.txid,
                            data: content
                        }, key);
                    }
                    compactIDB.writeData("lastTx", result.totalTxs, last_key, floDapps.root);
                    resolve(true);
                }).catch(error => reject(error))
            }).catch(error => reject(error))
        })
    }

    //BTC multisig application
    const multsig = messenger.multisig = {}
    const TYPE_BTC_MULTISIG = "btc_multisig";
    multsig.createAddress = function(pubKeys, minRequired) {
        return new Promise(async (resolve, reject) => {
            let co_owners = pubKeys.map(p => floCrypto.getFloID(p));
            if (co_owners.includes(null))
                return reject("Invalid public key: " + pubKeys[co_owners.indexOf(null)]);
            let privateKey = await floDapps.user.private;
            let multisig = btcOperator.multiSigAddress(pubKeys, minRequired) //TODO: change to correct function
            if (typeof multisig !== 'object')
                return reject("Unable to create multisig address");
            let content = {
                type: TYPE_BTC_MULTISIG,
                address: multisig.address, //TODO: maybe encrypt the address
                redeemScript: multisig.redeemScript
            };
            floBlockchainAPI.writeDataMultiple([privateKey], JSON.stringify({
                [floGlobals.application]: content
            }), co_owners).then(txid => {
                console.info(txid);
                let key = TYPE_BTC_MULTISIG + "|" + tx.txid.substr(0, 16);
                compactIDB.writeData("flodata", {
                    time: null, //time will be overwritten when confirmed on blockchain
                    txid: txid,
                    data: content
                }, key);
                resolve(multisig_addr);
            }).catch(error => reject(error))
        })
    }

    multsig.listAddress = function() {
        return new Promise((resolve, reject) => {
            let options = {
                lowerKey: `${TYPE_BTC_MULTISIG}|`,
                upperKey: `${TYPE_BTC_MULTISIG}||`
            }
            compactIDB.searchData("flodata", options).then(result => {
                let multsigs = {};
                for (let i in result) {
                    let addr = result[i].address;
                    let decode = coinjs.script().decodeRedeemScript(result[i].redeemScript);
                    if (!decode || decode.address !== addr)
                        console.warn("Invalid redeem-script:", addr);
                    else if (decode.type !== "multisig__")
                        console.warn("Redeem-script is not of a multisig:", addr);
                    else if (!decode.pubKeys.includes(user.public))
                        console.warn("User is not a part of this multisig:", addr);
                    else if (decode.pubKeys.length < decode.signaturesRequired)
                        console.warn("Invalid multisig (required is greater than users):", addr);
                    else
                        multsigs[addr] = {
                            redeemScript: decode.redeemScript,
                            pubKeys: decode.pubKeys,
                            minRequired: decode.signaturesRequired
                        }
                }
                resolve(multsigs);
            }).catch(error => reject(error))
        })
    }

    multsig.createTx = function(address, redeemScript, receivers, amounts) {
        return new Promise((resolve, reject) => {
            let decode = coinjs.script().decodeRedeemScript(redeemScript);
            if (!decode || decode.address !== address || decode.type !== "multisig__")
                return reject("Invalid redeem-script");
            else if (!decode.pubKeys.includes(user.public))
                return reject("User is not a part of this multisig");
            else if (decode.pubKeys.length < decode.signaturesRequired)
                return reject("Invalid multisig (required is greater than users)");
            let co_owners = decode.pubKeys.map(p => floCrypto.getFloID(p));
            let privateKey = await floDapps.user.private;
            btcOperator.createMultiSigTx(address, redeemScript, receivers, amounts, null).then(tx => {
                tx = btcOperator.signTx(tx, privateKey);
                createPipeline(TYPE_BTC_MULTISIG, co_owners, 32).then(pipeline => {
                    let message = encrypt(tx, pipeline.eKey);
                    sendRaw(message, pipeline.id, "TRANSACTION", false)
                        .then(result => resolve(result))
                        .catch(error => reject(error))
                }).catch(error => reject(error))
            }).catch(error => reject(error))
        })
    }

    multisig.signTx = function(pipeID, tx_hex, redeemScript) {
        return new Promise((resolve, reject) => {
            let decode = coinjs.script().decodeRedeemScript(redeemScript);
            if (!decode || decode.type !== "multisig__")
                return reject("Invalid redeem-script");
            else if (!decode.pubKeys.includes(user.public))
                return reject("User is not a part of this multisig");
            let pipeline = _loaded.pipeline[pipeID],
                tx = coinjs.transaction().deserialize(tx_hex);;
            let privateKey = await floDapps.user.private;
            tx_hex = btcOperator.signTx(tx, privateKey);
            let message = encrypt(tx_hex, pipeline.eKey);
            sendRaw(message, pipeline.id, "TRANSACTION", false).then(result => {
                if (!__Enough_signs_collected(tx)) //TODO
                    return resolve(tx_hex);
                __Arranged_signatures_if_needed(tx) //TODO
                btcOperator.broadcast(tx_hex).then(result => {
                    let txid = result.txid
                    sendRaw(encrypt(txid, pipeline.eKey), pipeline.id, "BROADCAST", false)
                        .then(result => resolve(txid))
                        .catch(error => reject(error))
                }).catch(error => reject(error))
            }).catch(error => reject(error))
        })
    }

    //Pipelines
    const createPipeline = function(model, members, ekeySize = 16) {
        //validate members
        let imem1 = [],
            imem2 = []
        members.forEach(m =>
            !floCrypto.validateAddr(m) ? imem1.push(m) :
            m in floGlobals.pubKeys ? null : imem2.push(m)
        );
        if (imem1.length)
            return reject(`Invalid Members(floIDs): ${imem1}`)
        else if (imem2.length)
            return reject(`Invalid Members (pubKey not available): ${imem2}`)
        //create pipeline info
        const id = floCrypto.tmpID;
        let pipeline = {
            id,
            model,
            members
        }
        if (ekeySize)
            pipeline.eKey = floCrypto.randString(ekeySize);
        //send pipeline info to members
        let pipelineInfo = JSON.stringify(pipeline);
        let promises = members.map(m => sendRaw(pipelineInfo, m, "CREATE_PIPELINE", true));
        Promise.allSettled(promises).then(results => {
            console.debug(results.filter(r => r.status = "rejected").map(r => r.reason));
            _loaded.pipeline[pipeline.id] = Object.assign(pipeline, {});
            if (pipeline.eKey)
                pipeline.eKey = encrypt(pipeline.eKey);
            compactIDB.addData("pipeline", pipeline, pipeline.id).then(result => {
                requestPipelineInbox(pipeline.id, pipeline.model);
                resolve(_loaded.pipeline[pipeline.id])
            }).catch(error => reject(error))
        })
    }

    function requestPipelineInbox(pipeID, model) {
        if (pipeConnID[pipeID]) { //close existing request connection (if any)
            floCloudAPI.closeRequest(pipeConnID[pipeID]);
            delete pipeConnID[pipeID];
        }

        let parseData = processData.pipeline[model](pipeID);
        let callbackFn = function(dataSet, error) {
            if (error)
                return console.error(error);
            console.info(dataSet)
            let newInbox = {
                messages: {}
            }
            for (let vc in dataSet) {
                if (pipeID !== dataSet[vc].receiverID)
                    continue;
                try {
                    parseData(dataSet[vc], newInbox);
                    if (data.sender !== user.id)
                        addMark(pipeID, "unread")
                    if (!_loaded.appendix[`lastReceived_${pipeID}`] ||
                        _loaded.appendix[`lastReceived_${pipeID}`] < vc)
                        _loaded.appendix[`lastReceived_${pipeID}`] = vc;
                } catch (error) {
                    console.log(error)
                }
            }
            compactIDB.writeData("appendix", _loaded.appendix[`lastReceived_${pipeID}`], `lastReceived_${pipeID}`);
            console.debug(newInbox);
            UI.pipeline(model, newInbox);
        }

        floCloudAPI.requestApplicationData(null, {
                receiverID: pipeID,
                lowerVectorClock: _loaded.appendix[`lastReceived_${pipeID}`] + 1,
                callback: callbackFn
            }).then(conn_id => pipeConnID[pipeID] = conn_id)
            .catch(error => console.error(`request-pipeline(${pipeID}):`, error))
    }

    processData.pipeline = {};
    processData.pipeline[TYPE_BTC_MULTISIG] = function(pipeID) {
        return (unparsed) => {
            if (!_loaded.pipeline[pipeID].members.includes(floCrypto.toFloID(unparsed.senderID)))
                return;
            let data = {
                time: unparsed.time,
                sender: unparsed.senderID,
                pipeID: unparsed.receiverID
            }
            let k = _loaded.pipeline[pipeID].eKey;
            unparsed.message = decrypt(unparsed.message, k)
            //store the pubKey if not stored already
            floDapps.storePubKey(unparsed.senderID, unparsed.pubKey);
            if (unparsed.type === "TRANSACTION") {
                data.message = encrypt(unparsed.message);
            } else if (unparsed.type === "BROADCAST") {
                data.txid = unparsed.message;
                //TODO: check if txid is valid (and confirmed?) and close the pipeline connection
            }
            compactIDB.addData("messages", {
                ...data
            }, `${pipeID}|${vc}`);
            if (data.message)
                data.message = decrypt(data.message);
            newInbox.messages[vc] = data;
        }
    }

})();