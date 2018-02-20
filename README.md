# conventionalizing_hierarchies
code, data, and analysis for ['learning to communicate about conceptual hierarchies'](https://github.com/hawkrobe/conventionalizing_hierarchies/blob/master/writing/cogsci18/hawkins_2_1.pdf) paper

# Experiment 
To launch the experiment, go to experiments directory, install dependencies with `npm install`, then run `node app.js --expname experiment1`. The experiment will be then be running in the browser at `localhost:8888/experiment1/index.html`.

# Analyses
All figures and statistical results can be reproduced from the R Markdown document in `/analysis/`. 

# Models
To reproduce model results, run `npm install` inside `/models/holistic/refModule` to install dependencies, then follow instructions inside `runbatch_BDA.sh`. To get predictives, use `runbatch_predict.sh`.
