/*
 * Food Aid Project Service Corps public configuration.
 *
 * Leave endpoint empty until the reviewed Google Apps Script web app is deployed.
 * Never place a spreadsheet ID, API key, token, respondent data, or other secret here.
 */
window.FAP_SERVICE_CORPS_CONFIG = Object.freeze({
  endpoint: '',
  responseOrigins: [
    'https://script.google.com',
    'https://script.googleusercontent.com'
  ]
});

/*
 * The first backend schema stores outreach details inside existing private
 * Relationships, Skill Areas, and Schedule columns. This adapter preserves all
 * outreach answers without requiring a public-site secret or a database schema
 * migration before the controlled deployment is approved.
 */
document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('intake-form');
  if (!form) return;

  form.addEventListener('submit', function () {
    var config = window.FAP_SERVICE_CORPS_CONFIG || {};
    if (!config.endpoint || form.dataset.outreachAdapted === 'true') return;

    var relationships = document.getElementById('relationships');
    var schedule = document.getElementById('schedule');
    var platforms = Array.prototype.map.call(
      form.querySelectorAll('input[name="outreachPlatform"]:checked'),
      function (input) { return input.value; }
    );

    var outreachLines = [
      'Outreach platforms: ' + (platforms.join('; ') || 'Not provided'),
      'Public profile: ' + ((document.getElementById('public-profile') || {}).value || 'Not provided'),
      'Audience/network size: ' + ((document.getElementById('audience-size') || {}).value || 'Not provided'),
      'Audience description: ' + ((document.getElementById('audience-description') || {}).value || 'Not provided'),
      'Content/outreach formats: ' + ((document.getElementById('content-formats') || {}).value || 'Not provided'),
      'Outreach ideas: ' + ((document.getElementById('outreach-ideas') || {}).value || 'Not provided')
    ];

    if (relationships) {
      relationships.value = [relationships.value.trim(), outreachLines.join('\n')]
        .filter(Boolean)
        .join('\n\n');
    }

    if (schedule) {
      var timeZone = ((document.getElementById('time-zone') || {}).value || '').trim();
      if (timeZone) {
        schedule.value = [schedule.value.trim(), 'Time zone: ' + timeZone]
          .filter(Boolean)
          .join('; ');
      }
    }

    platforms.forEach(function (platform) {
      var hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.name = 'skillArea';
      hidden.value = 'Outreach platform: ' + platform;
      form.appendChild(hidden);
    });

    form.dataset.outreachAdapted = 'true';
  }, true);
});
