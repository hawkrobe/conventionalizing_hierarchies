// We want to test both directions of the lexicon.
// Given a word, what objects does it apply to; given an object, what words apply to it?
function setupPostTest () {
  setupOverlay();
  globalGame.testTargets = _.shuffle(['word', 'object']);
  globalGame.currTargetType = globalGame.testTargets.shift();
  globalGame.selections = [];
  
  var button = document.getElementById('post_test_button');
  var objectNames = _.map(globalGame.allObjects, 'name');
    
  var showNextTarget = () => {
    var targets = globalGame.currTargetType == 'word' ? globalGame.labels : objectNames;
    var targetTag = globalGame.currTargetType == 'word' ? '#word_grid p' : '#object_grid img';
    var targetProperty = globalGame.currTargetType == 'word' ?  'color' : 'border-color';
    var targetSelectedColor = globalGame.currTargetType == 'word' ? 'white' : 'grey';
    var targetUnselectedColor = globalGame.currTargetType == 'word' ? 'grey' : 'white';
    
    // Highlight new target
    globalGame.targetNum += 1;
    globalGame.currTarget = targets[globalGame.targetNum];
    var newTarget = $(`${targetTag}[data-name~="${globalGame.currTarget}"`)
	.css(_.zipObject([targetProperty], [targetSelectedColor]));
  };

  button.onclick = () => {
    var optionTag = globalGame.currTargetType == 'word' ? '#object_grid img' : '#word_grid p';
    var optionProperty = globalGame.currTargetType == 'word' ? 'border-color' : 'color';
    var optionSelectedColor = globalGame.currTargetType == 'word' ? 'grey' : 'white';
    var optionUnselectedColor = globalGame.currTargetType == 'word' ? 'white' :  'grey';
    var targetTag = globalGame.currTargetType == 'word' ? '#word_grid p' : '#object_grid img';
    var targetProperty = globalGame.currTargetType == 'word' ?  'color' : 'border-color';
    var targetUnselectedColor = globalGame.currTargetType == 'word' ? 'grey' : 'white';
    
    var limit = (globalGame.currTargetType == 'word' ? globalGame.labels.length - 1 :
		 globalGame.allObjects.length - 1);

    // Temporarily disable button to prevent trigger happy people
    var oldValue = button.value;

    button.setAttribute('disabled', true);
    button.value = '...';

    setTimeout(function(){
      button.value = oldValue;
      button.removeAttribute('disabled');
    }, 2000);

    // Send data from current response
    globalGame.socket.send('postTest_' + globalGame.currTargetType + '.'
			   + globalGame.currTarget + '.'
			   + globalGame.selections.join('.'));

    // Unselect old target
    if(globalGame.currTarget) {
      var oldTarget = $(`${targetTag}[data-name~="${globalGame.currTarget}"`)
	  .css(_.zipObject([targetProperty], [targetUnselectedColor]));
    }

    // Clear previous selections
    $(optionTag).css(_.zipObject([optionProperty], [optionUnselectedColor]));
    globalGame.selections = [];

    // If you've advanced through both objs and words, move on to exit survey
    if(globalGame.targetNum >= limit && globalGame.testTargets.length == 0){
      $('#post_test').hide();
      $('#exit_survey').show();
    // If you're done with first batch, move to second
    } else if(globalGame.targetNum >= limit) {
      globalGame.currTargetType = globalGame.testTargets.shift();
      // Make sure all borders are gone
      setupPostTestHTML();
      showNextTarget();      
    } else {
      showNextTarget();
    }
  };  

  // Populate display fields
  _.forEach(globalGame.labels, (word) =>{
    $('#word_grid').append(
      $('<p/>')
	.css({color: 'grey'})
	.addClass('cell')
	.addClass('noselect')
	.text(word)
	.attr({'data-name' : word})      
    );
  });
  
  _.forEach(globalGame.allObjects, (obj) => {
    $("#object_grid").append(
      $('<img/>')
      	.attr({height: "50%", width: "25%", src: obj.url,
	       'data-name' : obj.name})
	.css({border: '10px solid', 'border-color' : 'white'})
  	.addClass("imgcell")
    );
  });

  setupPostTestHTML();
  showNextTarget();
};

var setupPostTestHTML = function() {
  // Set up instructions and grid locations
  globalGame.targetNum = -1;

  // Set target array at top
  var intendedTop = `#${globalGame.currTargetType}_grid`;
  $(intendedTop).insertAfter( $('#post_test_instruction') );

  // Unbind old click listeners if they exist 
  $(globalGame.currTargetType == 'word' ? '#word_grid p' : '#object_grid img')
    .off('click');

  // Set new listeners
  $(globalGame.currTargetType == 'word' ? '#object_grid img' : '#word_grid p')
    .click(function(event) {
      var optionProperty = globalGame.currTargetType == 'word' ? 'border-color' : 'color';
      var selectedColor = globalGame.currTargetType == 'word' ? 'grey' : 'white';
      var unselectedColor = globalGame.currTargetType == 'word' ? 'white' : 'grey';
      if(_.includes(globalGame.selections, $(this).attr('data-name'))) {
	_.remove(globalGame.selections, obj => obj == $(this).attr('data-name'));
	$(this).css(_.zipObject([optionProperty], [unselectedColor]));
      } else {
	globalGame.selections.push($(this).attr('data-name'));
	$(this).css(_.zipObject([optionProperty], [selectedColor]));
      }
    });

  // Update instructions
  var wordTaskInstruction = "<p style='font-size:150%'>For each highlighted <b>word</b>, please click all of the <b>objects</b> it can refer to, then click 'next'.</p><p>If you're not sure, or it doesn't mean anything, click 'next' without making a selection.</p>";
  
  var objTaskInstruction = "<p style='font-size:150%'>For each highlighted <b>object</b>, please click all of the <b>words</b> that can refer to it, then click 'next'.</p><p>If you're not sure, or if none of the words refer to it, click 'next' without making a selection.</p>";
  
  $('#post_test_instruction').html(globalGame.currTargetType == 'word' ?
  				   wordTaskInstruction : objTaskInstruction);
};
