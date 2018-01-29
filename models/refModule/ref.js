var _ = require('lodash');
var fs = require('fs');
var babyparse = require('babyparse');

var normalize = function(truth, sum) {
  return ad.scalar.sub(truth, ad.scalar.log(sum));
};

var utterances = _.map(_.range(1, 17), function(i) {return 'word' + i;});
var states = [{'name' : 'blueSquare1',    features: [-2,  0,  5,  0,  0]},
	      {'name' : 'blueSquare2',    features: [-2,  0, 10,  0,  0]},
	      {'name' : 'redSquare1',     features: [-2,  5,  0,  0,  0]},
	      {'name' : 'redSquare2',     features: [-2, 10,  0,  0,  0]},
	      {'name' : 'spottedCircle1', features: [ 2,  0,  0,  0,  5]},
	      {'name' : 'spottedCircle2', features: [ 2,  0,  0,  0, 10]},
	      {'name' : 'stripedCircle1', features: [ 2,  0,  0,  5,  0]},
	      {'name' : 'stripedCircle2', features: [ 2,  0,  0, 10,  0]}];

var numFeatures = 5;

var l2 = function(x,y) {
  var squaredDiff = T.pow(T.sub(x, y), 2);
  return ad.scalar.sqrt(T.sumreduce(squaredDiff));
};

// The meaning of an utterance is its similarity to the target
var meaning = function(lexicon, utt, target) {
  var utt_i = _.indexOf(utterances, utt);
  var target_i = _.indexOf(_.map(states, 'name'), target);
  var targetFeatures = T.fromScalars(states[target_i]['features']);
  var lexiconMeans = T.range(lexicon, utt_i * numFeatures,
			     utt_i * numFeatures + numFeatures);
  return l2(lexiconMeans, targetFeatures);
};

// P(target | sketch) \propto e^{scale * sim(t, s)}
// => log(p) = scale * sim(target, sketch) - log(\sum_{i} e^{scale * sim(t, s)})
var getL0score = function(target, utt, params) {
  var scores = [];
  var sum = 0;
  var truth = meaning(params.lexicon, utt, target);
  for(var i=0; i<params.context.length; i++){
    sum = ad.scalar.add(
      sum, ad.scalar.exp(
	meaning(params.lexicon, utt, params.context[i])));
  }
  return normalize(truth, sum);
};

// return log P(u | o, c, l)
var getSpeakerScore = function(utt, targetObj, params) {
  var scores = [];
  var sum = 0;
  var truth = ad.scalar.mul(params.alpha, getL0score(targetObj, utt, params));
  for(var i=0; i< utterances.length; i++){
    var inf = getL0score(targetObj, utterances[i], params);
    sum = ad.scalar.add(sum, ad.scalar.exp(ad.scalar.mul(params.alpha, inf)));
  }
  return normalize(truth, sum);
};

// if P(o | u, c, l) = P(u | o, c, l) P(u | c, l) / sum_o P(u | o, c, l)
// then log(o | u, c, l) = log P(u | o, c, l) - log(sum_{o in context} P(u | o, c, l))
var getListenerScore = function(trueObj, utt, params) {
  var scores = [];
  var sum = 0;
  var truth = getSpeakerScore(utt, trueObj, params);
  for(var i=0; i< params.context.length; i++){
    var prob = getSpeakerScore(utt, params.context[i], params);
    sum = ad.scalar.add(sum, ad.scalar.exp(prob));
  }
  return normalize(truth, sum);
};

// var reformatParams = function(modelOutput, data, drift) {
//   // Makes analysis a lot easier if there's a separate col for every word in the csv
//   var trialNums = _.map(data, 'trialNum');
//   var lexiconKeys = _.flattenDeep(_.map(trialNums, function(trialNum) {
//     return _.map(_.range(1,17), function(wordNum) {
//       return _.map(states, function(state) {
// 	return wordNum + '_' + state + '_' + trialNum;
//       });
//     });
//   }));
//   var lexiconVals = _.flattenDeep(_.map(modelOutput, function(l) {
//     var lexicon = T.sigmoid(l);
//     var wordList = T.split(lexicon, [8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8]);
//     return _.map(wordList, function(word) {
//       return T.toScalars(word);
//     });
//   }));
//   var lexica = _.zipObject(lexiconKeys, lexiconVals);
//   var driftRates = drift;

//   return {
//     params : _.values(lexica).join(','),
//     driftRates: driftRates,
//     paramsHeader: _.keys(lexica).join(','),
//     driftsHeader: 'driftRates'
//   };
// }

var reformatData = function(rawData) {
  return _.map(rawData, function(row) {
    return _.omit(_.extend(row, {
      context: [row.object1name, row.object2name, row.object3name, row.object4name]
    }), 'object1name', 'object2name', 'object3name', 'object4name');
  });
}

function readCSV(filename){
  return babyparse.parse(fs.readFileSync(filename, 'utf8'),
			 {header:true, skipEmptyLines:true}).data;
};

function writeCSV(jsonCSV, filename){
  fs.writeFileSync(filename, babyparse.unparse(jsonCSV) + '\n');
}

function appendCSV(jsonCSV, filename){
  fs.appendFileSync(filename, babyparse.unparse(jsonCSV) + '\n');
}

// Note this is highly specific to a single type of erp
var bayesianErpWriter = function(erp, filePrefix) {
  var supp = erp.support();

  if(_.has(supp[0], 'params')) {
    var paramFile = fs.openSync(filePrefix + "Params.csv", 'w');
    fs.writeSync(paramFile, supp[0]['paramsHeader'] + '\n');
  }

  if(_.has(supp[0], 'driftRates')) {
    var driftsFile = fs.openSync(filePrefix + "Drifts.csv", 'w');
    fs.writeSync(driftsFile, supp[0]['driftsHeader'] + '\n');
  }


  supp.forEach(function(s) {
    if(_.has(s, 'params'))
      fs.writeSync(paramFile, s.params+'\n');
    if(_.has(s, 'driftRates'))
      fs.writeSync(driftsFile, s.driftRates+'\n');
  });

  if(_.has(supp[0], 'params')) {
    fs.closeSync(paramFile);
  }
  if(_.has(supp[0], 'driftRates')) {
    fs.closeSync(driftsFile);
  }

  console.log('writing complete.');
};

module.exports = {
  getL0score, getSpeakerScore, getListenerScore, 
  reformatData, bayesianErpWriter, writeCSV, readCSV
};
