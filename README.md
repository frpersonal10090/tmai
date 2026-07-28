https://frpersonal10090.github.io/tmai/

cd ~/Projects/tmai

# Save and publish development work
git switch level6
git status
node run_tests.js
git add -A
git commit -m "UI upgrade"
git push origin level6

# Publish the tested version to master / GitHub Pages
git switch master
git pull --ff-only origin master
git merge --ff-only level6
node run_tests.js
git push origin master

# Return to development
git switch level6
git status