var config        = require('./config');
var GitHubApi     = require('github');
var applescript   = require('applescript');
var github        = new GitHubApi({ version: '3.0.0' });
var sleep         = require('sleep');
var temp          = require('temp');
var fs            = require('fs');

// authenticate to github
github.authenticate({type: 'oauth', token: config.token });

/**
 * lastChecked = last time we polled the repo.
 * Only get issues updated since then.
 */
var lastChecked;
fs.readFile('./lastChecked.txt', 'utf8', function (err, data) {
  if(err) handleError(err);
  lastChecked = data;
});

// Get github issues for repo
github.issues.repoIssues({
  // mentioned: config.assignee
   since: lastChecked
  , filter: 'assigned'
  , state: 'all'
  , user: config.user
  , repo: config.repo
  , assignee: config.assignee
  , per_page: 100 // TODO: breaks on more than 100 issues
}, updateIssues);

/**
 * Update the issues that GitHub returns, if any.
 *
 * @param  {object} err    Error Message
 * @param  {object} issues https://developer.github.com/v3/issues/
 */
function updateIssues(err, issues) {

  // Save the time we've just polled
  fs.writeFile('./lastChecked.txt', new Date().toISOString(), function(err) {
    if(err) handleError(err);
  });

  if(err || issues.length <= 0) {
    return;
  }

  var script = formatScript(issues);

  temp.open('github-to-omnifocus', function(err, info) {
    if (err) handleError(err);

    fs.write(info.fd, script);
    fs.close(info.fd, function(err) {
      if (err) handleError(err);

      applescript.execFile(info.path, ["-lJavaScript"], function(err, rtn) {
        if (err) handleError(err);
      });
    });
  });
}

/**
 * Formation JavaScript to be run by Node Applescript:
 * https://github.com/TooTallNate/node-applescript
 *
 * @param  {object} issues   JSON object of GitHub issues
 * @return {string}          Formatted script to run
 */
function formatScript(issues) {
  var script = '';

  script += 'var of = Library(\'OmniFocus\');\n';
  script += 'var name = "";\n';
  script += 'var toClose = "";\n';

  issues.forEach(function(issue) {

    // If our config is set to listen to only certain
    // milestones, ignore any issues without milestones
    // or with different milestone
    if(config.milestones.length > 0) {
      if(!issue.milestone || issue.milestone.title.indexOf(config.milestones) === -1) {
        return;
      }
    }

    // Action Name
    var name = '[#' + issue.number + '] ' + issue.title;

    // Close open issues
    if( issue.state === 'closed' ) {

      script += closeActionScript(name);

    // Create new open issues
    } else if( issue.state === 'open' ) {

      var note = (issue.body.length > 1) ? issue.html_url + '\n\n' + issue.body : issue.html_url;
      var project = (issue.milestone && issue.milestone.title) ? issue.milestone.title : false;
      var dueDate = (issue.milestone && issue.milestone.due_on) ? new Date(issue.milestone.due_on).toDateString() : false;

      script += addActionScript(name, note, project, dueDate);
    }

  });

  return script;
}

/**
 * Add a new (unique) action to omnifocus.
 *
 * Uses OmniFocus transport text:
 * Action! @Context ::Project #Start #Due $Duration //Note
 *
 *
 * @param {string} name      Action Name
 * @param {string} note      Action Note
 * @param {string} project   Add To Project Name
 * @param {string} dueDate   Date Due
 */
function addActionScript(name, note, project, dueDate) {
  var script = '';

  name = name.trim();

  var transportText = name;

  if(project) {
    transportText += ' ::' + project;
  }

  if(dueDate) {
    transportText += ' #' + dueDate;
  }

  if(note) {
    transportText += ' //' + note;
  }

  script += "name = " + JSON.stringify(name) + ";"
  script += 'if(of.tasksWithName(name).length <= 0) {';
    script += "of.parse(" + JSON.stringify(transportText) + ")";
  script += '}\n';

  return script;
}

/**
 * Mark an action as completed
 *
 * @return {[type]} [description]
 */
function closeActionScript(name) {
  var script = '';

  script += "name = " + JSON.stringify(name) + ";\n"
  script += "toClose = of.tasksWithName(name);\n"
  script += 'if(toClose.length > 0) {';
    script += "of.setCompleted(toClose, true)";
  script += '}\n';

  return script;
}

/**
 * Handle errors in a dumb way.
 *
 * @param  {object} err Error code
 */
function handleError(err) {
  console.log('err', err);
}
