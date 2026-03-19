import sys
import json
import numpy as np
import skfuzzy as fuzz
from skfuzzy import control as ctrl

def calculate_fuzzy(duration_val, count_val):
    duration = ctrl.Antecedent(np.arange(0, 13, 1), 'duration')
    count = ctrl.Antecedent(np.arange(0, 9, 1), 'count')
    density = ctrl.Consequent(np.arange(0, 101, 1), 'density')

    duration['ringan'] = fuzz.trimf(duration.universe, [0, 0, 5])
    duration['sedang'] = fuzz.trimf(duration.universe, [3, 5, 8])
    duration['berat']  = fuzz.trimf(duration.universe, [6, 12, 12])

    count['sedikit'] = fuzz.trimf(count.universe, [0, 0, 3])
    count['cukup']   = fuzz.trimf(count.universe, [2, 4, 6])
    count['banyak']  = fuzz.trimf(count.universe, [5, 8, 8])

    density['tidak padat']  = fuzz.trimf(density.universe, [0, 0, 40])
    density['cukup padat']  = fuzz.trimf(density.universe, [30, 50, 70])
    density['sangat padat'] = fuzz.trimf(density.universe, [60, 100, 100])

    rule1 = ctrl.Rule(duration['ringan'] & count['sedikit'], density['tidak padat'])
    rule2 = ctrl.Rule(duration['ringan'] & count['cukup'],   density['tidak padat'])
    rule3 = ctrl.Rule(duration['sedang'] & count['sedikit'], density['tidak padat'])
    rule4 = ctrl.Rule(duration['ringan'] & count['banyak'],  density['cukup padat'])
    rule5 = ctrl.Rule(duration['sedang'] & count['cukup'],   density['cukup padat'])
    rule6 = ctrl.Rule(duration['berat']  & count['sedikit'], density['cukup padat'])
    rule7 = ctrl.Rule(duration['sedang'] & count['banyak'],  density['sangat padat'])
    rule8 = ctrl.Rule(duration['berat']  & count['cukup'],   density['sangat padat'])
    rule9 = ctrl.Rule(duration['berat']  & count['banyak'],  density['sangat padat'])

    system_ctrl = ctrl.ControlSystem([rule1, rule2, rule3, rule4, rule5, rule6, rule7, rule8, rule9])
    sim = ctrl.ControlSystemSimulation(system_ctrl)

    sim.input['duration'] = np.clip(duration_val, 0, 12)
    sim.input['count']    = np.clip(count_val, 0, 8)
    sim.compute()

    return sim.output['density']

if __name__ == "__main__":
    args = json.loads(sys.argv[1])
    result = calculate_fuzzy(args['duration'], args['count'])
    print(json.dumps({"score": round(result, 2)}))