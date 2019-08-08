const CYCLE = 130; // should be a cycle that have passed
const N = 6; // Number of async calls that can be made in parallel
const apiURL = "https://api2.tzscan.io";
const api2URL = "https://api.tzbeta.net:8080";
const TOTAL_GENESIS_BALANCE = 610645544; // TF + DLS excluded
$("document").ready(function() {
  init();
});
async function init() {
  // CF address
  const cfAddress = "tz2KrmHRWu7b7Vr3GYQ3SJ41xaW64PiqWBYm";
  println("CF address: " + cfAddress + "\n");

  // donation addresses
  let donationAddresses = await getDonationAddresses(cfAddress);
  var uniqueDonationAddresses = donationAddresses.length;
  println("Unique donation addresses: (" + uniqueDonationAddresses + ")");
  println("Donator | Delegators");

  var [delegators, count] = await getAllDelegators(donationAddresses);
  for (var i = 0; i < donationAddresses.length; i++)
    println(donationAddresses[i] + "\t" + count[i]);

  println("\nDonators: ");
  println(
    "Donator | Identity | Parent | Genesis distance | Genesis allocation"
  );
  var m = donationAddresses.length;
  donationAddresses = await getGenesisConnection(donationAddresses, m);
  var levelB = split(donationAddresses, m);
  log("Removing duplicates...");
  levelB = removeDuplicates(levelB);
  var genesisBalance1 = getGenesisBalance(levelB);
  println(
    "\nTotal balance on genesis distance 0: " + genesisBalance1[0] + " mutez"
  );
  println(
    "Total balance on genesis distance 1: " + genesisBalance1[1] + " mutez"
  );
  println(
    "Total balance on genesis distance 0 + 1: " +
      (genesisBalance1[0] + genesisBalance1[1]) +
      " mutez\n"
  );

  // delegators
  println(
    "Delegators for cycle " +
      CYCLE +
      " to a donator: (" +
      delegators.length +
      ")"
  );
  println(
    "Delegatee | Delegator | Identity | Parent | Genesis distance | Genesis allocation"
  );
  m = delegators.length;
  delegators = await getGenesisConnection(delegators, m);
  log("Printing all delegators...");
  var levelD = split(delegators, m);
  log("Removing duplicates...");
  levelD = removeDuplicates(levelD, levelB);
  var genesisBalance2 = getGenesisBalance(levelD);
  println(
    "\nTotal balance on genesis distance 0: " + genesisBalance2[0] + " mutez"
  );
  println(
    "Total balance on genesis distance 1: " + genesisBalance2[1] + " mutez"
  );
  println(
    "Total balance on genesis distance 0 + 1: " +
      (genesisBalance2[0] + genesisBalance2[1]) +
      " mutez"
  );
  var totalXtz =
    genesisBalance1[0] +
    genesisBalance1[1] +
    genesisBalance2[0] +
    genesisBalance2[1];
  var totalWallets =
    levelB[0].length + levelB[1].length + levelD[0].length + levelD[1].length;
  println(
    "\nTotal genesis balance for donators + delegators, level 0 + 1: " +
      totalXtz +
      " mutez (" +
      totalWallets +
      ")"
  );
  log("Done!");

  // Create summary
  var summary =
    "##################################################  START SUMMARY  ##################################################\n\n" +
    "The Commonwealth Fundraiser (CF) baker received donations from " +
    uniqueDonationAddresses +
    ' unique delegate, or "baker", addresses in support\nof the affidavit. These donors\' control' +
    mu2tez(genesisBalance1[0] + genesisBalance1[1]) +
    " tez (XTZ) directly from the fundraiser allocation. Through the\nTezos delegation feature these bakers serve as an elected " +
    "representative on behalf of a much larger group of\nparticipants, that have a fundraiser allocation of " +
    mu2tez(totalXtz) +
    " tez from " +
    totalWallets +
    " fundraiser wallets. Combined, this would\nequal " +
    Math.round((10000 * mu2tezInt(totalXtz)) / TOTAL_GENESIS_BALANCE) / 100 +
    "% of the total genesis balance (TF and DLS excluded) If we disregard the HW assumption (see details below),\n" +
    "the previous numbers would be " +
    mu2tez(genesisBalance1[0]) +
    " tez, " +
    mu2tez(genesisBalance1[0] + genesisBalance2[0]) +
    " tez, " +
    (levelB[0].length + levelD[0].length) +
    " wallets and " +
    Math.round(
      (10000 * mu2tezInt(genesisBalance1[0] + genesisBalance2[0])) /
        TOTAL_GENESIS_BALANCE
    ) /
      100 +
    "%.\n\n" +
    "This data was collected from the Tezos blockchain at " +
    new Date().toLocaleString() +
    " by looking at the donations to the CF\naddress" +
    "and the active delegations at cycle " +
    CYCLE +
    ". The donors fundraiser allocations were tracked and in case someone \n" +
    "had chosen them as delegatee, their fundraiser allocations were accounted for indirectly." +
    "\n\nA fundraiser wallet was defined as the addresses controlled by the cryptographic keypair generated at the \n" +
    "fundraiser back in July 2017. Tokens that have only been transferred from a fundraiser wallet to another separate \n" +
    "wallet is considered to be under the control by the same person. The technical reasoning for this is how HW wallets \n" +
    "work and how transferring ownership of tokens in general require a trusted 3rd party (i.e., an exchange), and\ntherefore more than one transfer on the blockchain." +
    "\n\n###################################################  END SUMMARY  ###################################################\n\n";
  $("#container").html(summary + $("#container").html());
}
function getDonationAddresses(address, accounts = [], page = 0) {
  const lastCycleBlock = (CYCLE + 1) * 4096;
  return new Promise(resolve => {
    $.ajax({
      type: "GET",
      url:
        apiURL +
        "/v3/operations/" +
        address +
        "?type=Transaction&p=" +
        page +
        "&number=50",
      success: function(d) {
        for (var i = 0; i < d.length; i++) {
          if (
            d[i].type.source.tz !== address &&
            accounts.indexOf(d[i].type.source.tz) === -1 &&
            d[i].type.operations[0].op_level <= lastCycleBlock
          ) {
            accounts.push(d[i].type.source.tz);
          }
        }
        if (d.length < 50) resolve(accounts);
        else resolve(getDonationAddresses(address, accounts, ++page));
      }
    });
  });
}
async function getAllDelegators(donationAddresses) {
  var delegators = [];
  var count = [];
  for (var i = 0; i < donationAddresses.length; i++) {
    var counter = 0;
    var chunk = await getDelegators(donationAddresses[i]);
    for (var j = 0; j < chunk.length; j++) {
      counter++;
      delegators.push({ KT: chunk[j], baker: donationAddresses[i] });
    }
    log("delegators found: " + delegators.length);
    count.push(chunk.length);
  }
  return [delegators, count];
}
function getDelegators(address, accounts = [], page = 0) {
  return new Promise(resolve => {
    $.ajax({
      type: "GET",
      url:
        apiURL +
        "/v1/rewards_split_fast/" +
        address +
        "?cycle=" +
        (CYCLE + 5) +
        "&p=" +
        page +
        "&number=50",
      success: function(d) {
        for (var i = 0; i < d.length; i++) {
          if (d[i][1] !== "0" && d[i][1] !== 0) accounts.push(d[i][0].tz);
        }
        if (d.length < 50) resolve(accounts);
        else resolve(getDelegators(address, accounts, ++page));
      }
    });
  });
}
async function getDelegatorData(KT, baker) {
  var delegate = {
    KT: KT,
    tz: "",
    parent: "",
    genesisDistance: "1+",
    balance: 0
  };
  if (baker) delegate.baker = baker;
  delegate.tz = await getManager(KT);
  var activation = await getActivation(delegate.tz);
  if (activation.done) {
    delegate.genesisDistance = "0";
    delegate.balance = parseInt(activation.balance);
  } else {
    delegate.parent = await getParent(delegate.tz);
    var activation = await getActivation(delegate.parent);
    if (activation.done) {
      delegate.genesisDistance = "1";
      delegate.balance = parseInt(activation.balance);
    }
  }
  return delegate;
}
function getManager(KT) {
  return new Promise(resolve => {
    if (KT.substring(0, 2) === "tz") resolve(KT);
    $.ajax({
      type: "GET",
      url: api2URL + "/v1/node_account/" + KT,
      success: function(d) {
        resolve(d.manager.tz);
      }
    });
  });
}
function getParent(address) {
  return new Promise(resolve => {
    $.ajax({
      type: "GET",
      url: apiURL + "/v3/number_operations/" + address + "?type=Transaction",
      success: function(d) {
        var transactionsCount = d[0];
        if (transactionsCount > 0) {
          $.ajax({
            type: "GET",
            url:
              apiURL +
              "/v3/operations/" +
              address +
              "?type=Transaction&p=" +
              --transactionsCount +
              "&number=1",
            success: function(d) {
              var parent = d[0].type.source.tz;
              if (parent.substring(0, 2) === "KT") {
                resolve(getManager(parent));
              } else {
                resolve(parent);
              }
            }
          });
        } else {
          // For special cases with external originator (e.g. tz1PNg922K3xkkNp8nSi8WrZNZGCQZYCQD5b)
          $.ajax({
            type: "GET",
            url:
              apiURL + "/v3/number_operations/" + address + "?type=Origination",
            success: function(d) {
              var originationCount = d[0];
              $.ajax({
                type: "GET",
                url:
                  apiURL +
                  "/v3/operations/" +
                  address +
                  "?type=Origination&p=" +
                  --originationCount +
                  "&number=1",
                success: function(d) {
                  var parent = d[0].type.source.tz;
                  if (parent.substring(0, 2) === "KT") {
                    resolve(getManager(parent));
                  } else {
                    resolve(parent);
                  }
                }
              });
            }
          });
        }
      }
    });
  });
}
async function getGenesisConnection(delegators, m) {
  // Deep scan of delegators/donators
  var batch = [];
  // Send async calls in batches of N delegators at a times
  for (var i = 0; i < m; i++) {
    if (!delegators[i].KT) delegators[i] = { KT: delegators[i] };
    batch.push(getDelegatorData(delegators[i].KT, delegators[i].baker));
    if (!(batch.length < N - 1 && i < m - 1)) {
      log(
        "Scanning for genesis connection [" +
          (i - (N - 1)) +
          " - " +
          i +
          "] of " +
          (m - 1)
      );
      await Promise.all(batch).then(ans => {
        for (var j = 0; j < ans.length; j++) {
          delegators[i - (ans.length - 1) + j] = ans[j];
        }
        batch = [];
      });
    }
  }
  return delegators;
}
function removeDuplicates(level, dep = []) {
  console.log(" " + level[0].length + " + " + level[1].length);
  if (dep.length > 0) {
    // If a genesis allocation is accounted for a baker, it should not also be accounted for a delegate
    for (var m = 0; m < level[0].length; m++) {
      if (existInBakerAllocation(level[0][m].tz, dep)) {
        log("Remove: (baker->0) " + level[0][m].tz);
        level[0].splice(m, 1);
        m--;
      }
    }
    for (var m = 0; m < level[1].length; m++) {
      if (existInBakerAllocation(level[1][m].parent, dep)) {
        log("Remove: (baker->1) " + level[1][m].parent);
        level[1].splice(m, 1);
        m--;
      }
    }
  }
  for (var m = 0; m < level[0].length - 1; m++) {
    for (var n = m + 1; n < level[0].length; n++) {
      if (level[0][m].tz === level[0][n].tz) {
        log("Remove: (0->0) " + level[0][n].tz);
        level[0].splice(n, 1);
        n--;
      }
    }
    for (var n = 0; n < level[1].length; n++) {
      if (level[0][m].tz === level[1][n].parent) {
        log("Remove: (0->1) " + level[1][n].parent);
        level[1].splice(n, 1);
        n--;
      }
    }
  }
  for (var m = 0; m < level[1].length - 1; m++) {
    for (var n = m + 1; n < level[1].length; n++) {
      if (level[1][m].parent === level[1][n].parent) {
        log("Remove: (1->1) " + level[1][n].parent);
        level[1].splice(n, 1);
        n--;
      }
    }
  }
  console.log(" " + level[0].length + " + " + level[1].length);
  return level;
}
function existInBakerAllocation(tz, dep) {
  if (dep[0].findIndex(a => a.tz === tz) !== -1) return true;
  if (dep[1].findIndex(a => a.parent === tz) !== -1) return true;
  return false;
}
function getActivation(tz) {
  return new Promise(resolve => {
    $.ajax({
      type: "GET",
      url: apiURL + "/v3/operations/" + tz + "?type=Activation",
      success: function(d) {
        balance = 0;
        if (d.length) balance = d[0].type.operations[0].balance;
        resolve({ done: d.length, balance: balance });
      }
    });
  });
}
function split(data, m) {
  // Print out and return arrays with 0 & 1 genesis distances
  var level = [[], []];
  for (var i = 0; i < m; i++) {
    var baker = "";
    if (typeof data[i].baker !== "undefined") baker = data[i].baker + "\t";
    println(
      baker +
        data[i].KT +
        "\t" +
        data[i].tz +
        "\t" +
        data[i].parent +
        "\t" +
        data[i].genesisDistance +
        "\t" +
        data[i].balance
    );
    if (data[i].genesisDistance === "0") {
      level[0].push(data[i]);
    } else if (data[i].genesisDistance === "1") {
      level[1].push(data[i]);
    }
  }
  return level;
}
function getGenesisBalance(level) {
  //Print out and return total genesis balances
  var genesisBalance = [0, 0];
  println("\n0-level: (" + level[0].length + ")");
  println("Address | Identity | Genesis allocation");
  for (var i = 0; i < level[0].length; i++) {
    println(
      level[0][i].KT + "\t" + level[0][i].tz + "\t" + level[0][i].balance
    );
    genesisBalance[0] += level[0][i].balance;
  }
  println("\n1-level: (" + level[1].length + ")");
  println("Address | Identity | Parent | Genesis allocation");
  for (var i = 0; i < level[1].length; i++) {
    println(
      level[1][i].KT +
        "\t" +
        level[1][i].tz +
        "\t" +
        level[1][i].parent +
        "\t" +
        level[1][i].balance
    );
    genesisBalance[1] += level[1][i].balance;
  }
  return genesisBalance;
}
function println(output) {
  $("#container").append("\n" + output);
}
function print(output) {
  $("#container").append(output);
}
function log(output) {
  console.log(output);
  $("#log").html(output);
  if (output === "Done!") $("#log").css("display", "none");
}
function mu2tez(mu) {
  let tez = mu / 1000000;
  return Math.round(tez).toLocaleString();
}
function mu2tezInt(mu) {
  let tez = mu / 1000000;
  return Math.round(tez);
}
