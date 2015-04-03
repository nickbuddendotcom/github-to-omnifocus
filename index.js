#!/usr/bin/env node

// var OmniFocus   = require('./OmniFocus');

var config      = require('./config');
var GitHubApi   = require('github');
var applescript = require('applescript');
var github      = new GitHubApi({ version: '3.0.0' });
var sleep       = require('sleep');

github.authenticate({type: 'oauth', token: config.token});

github.issues.repoIssues({
  // headers : 'If-Modified-Since'
  // mentioned: 'nickbuddendotcom'
  // since: ''
  filter: 'assigned'
  , state: 'all'
  , user: config.user
  , repo: config.repo
  , assignee: config.assignee
}, updateIssues);

function updateIssues(err, issues) {
  if(err || issues.length <= 0) {
    return;
  }

  // Leaving off: this is an asshole. I want to have design and code contexts...
  // - Add Due Date
  // - Add Project (Beta)
  // - Add Issue Link to title
  // - Add issue desc to note
  // - Store github ID's in a file, skip adding anything that's already got an ID in the file
  // - Eventually I can handle updates as well...I can also save the last update date in a file and if anything has changed since then,
  //   update it wiether or not the ID's in the file. I can also use that to close it. That should be enough github integration.



  /*

  TRY THIS:

-- Determine whether OmniFocus is running.
tell application "System Events"
  set omnifocusActive to count (every process whose name is "OmniFocus")
end tell

if omnifocusActive > 0 then
  -- OmniFocus is running, so insert a task into it directly.
  tell application "OmniFocus" to tell document 1
    make new inbox task with properties {name:"TASK TITLE"}
  end tell
else
  -- OmniFocus isn't running, so use the Mail Drop method.
  do shell script "mail -s \"TASK TITLE\" " & mailDropAddress & " < /dev/null"
end if


   */



  // note: add forever.js
  // update each issue ...
  // If already have the issue ID, return...(need to save the ID's for anything already processed...)
  issues.forEach(function(issue) {

    var githubName = '[#' + issue.number + '] ' + issue.title;
    var script = 'parse tasks into it with transport text "' + githubName + '"';

    script += ' and context '

    var fullScript = 'tell application "OmniFocus"\ntell front document\n' + script + '\nend tell\nend tell\n';

    var script = '';


    sleep.usleep(100);
    // executeScript(script, function(err, res) {
    //   if (err) console.log(err);
    //   callback();
    // });

    applescript.execString(fullScript, function(err) {
      if (err) console.log(err);
    });

    // It would be good to put the issue describption into the notes too...
    // console.log('CHECK ISSUE', issue.title, issue.url, issue.number, issue.id);
  });
}

// http://pixelsnatch.com/omnifocus/ to Library/Script Libraries
// 1. chmod +x githubOmnifocusSync.js
// 2. sudo npm install -g (in directory, rerun to see changes)
// 3. githubOmnifocusSync
//
