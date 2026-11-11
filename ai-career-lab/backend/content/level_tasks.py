"""Additional practice contracts for a topic's intermediate and advanced interviews."""
from dataclasses import dataclass

@dataclass(frozen=True)
class Challenge:
    title: str
    prompt: str
    hint: str
    cases: tuple

def challenge(title,prompt,hint,*cases):
    return Challenge(title,prompt,hint,cases)

CHALLENGES = {
    "predicates": (
        challenge("Choose parcels for the locker","Given a list of parcel weights, return the positions of parcels with known weights greater than zero and at most 5 kg. None means unmeasured. Preserve arrival order.",
                  "Check for None before the numeric comparison. Include exactly 5.",
                  ([4,5,6,None],[0,1]), ([None,0,-1],[]),([],[]),([5,5],[0,1])),
        challenge("Find a policy counterexample","Two discount policies each specify [lower_age, upper_age, includes_lower, includes_upper]. Ages are whole years 0 through 120. Return the smallest age where their decisions differ, or None when they agree on every age.",
                  "Evaluate each pair of endpoint comparisons independently. A witness must give different decisions under the two policies.",
                  ([[5,12,True,False],[5,12,True,True]],12),([[0,18,False,False],[1,17,True,True]],None),([[0,0,True,True],[0,0,False,True]],0),([[3,8,True,False],[4,8,True,False]],3))
    ),
    "regression": (
        challenge("Report typical delivery error","Input rows are [actual_minutes, predicted_minutes]. Return the mean of the absolute errors, or None for no trips.",
                  "Work in minutes. Opposite signed errors should each contribute a positive distance.",
                  ([[20,17],[10,13]],3),([],None),([[5,5]],0),([[2,3],[6,4]],1.5)),
        challenge("Choose a model against a baseline","Rows are [actual, model_forecast, baseline_forecast]. Return 'model' only when its total absolute error is strictly smaller on the same trips. A tie chooses 'baseline'. Return None for no data.",
                  "Compare both forecasts against the same recorded outcome before adding errors.",
                  ([[10,9,6],[22,21,19]],"model"),([[4,5,3]],"baseline"),([[20,30,20]],"baseline"),([],None))
    ),
    "classification": (
        challenge("Build a parcel confusion table","Given [threshold, rows], where each row is [damage_score, actually_damaged], flag scores at or above the threshold. Return [true_positives, false_positives, false_negatives, true_negatives].",
                  "For each box, compare the predicted class with the recorded class.",
                  ([0.7,[[0.7,True],[0.8,False],[0.4,True],[0.1,False]]],[1,1,1,1]),([1,[]],[0,0,0,0]),([0,[[0,False],[0,True]]],[1,1,0,0])),
        challenge("Choose the cheaper inspection threshold","Input is [candidate_thresholds, labeled_rows]. Each [score, damaged] at or above a threshold is sent for inspection. A missed damaged parcel costs 5 and an unnecessary inspection costs 1. Return the candidate with the smallest total cost. For ties choose the largest threshold. The candidate list is nonempty.",
                  "Try each candidate on all parcels and count the two kinds of error separately.",
                  ([[0.4,0.8],[[0.5,True],[0.6,False]]],0.4),([[0.2,0.8],[]],0.8),([[0.7,0.8],[[0.7,True]]],0.7),([[0.2,0.6],[[0.5,False],[0.1,False]]],0.6))
    ),
    "train-test": (
        challenge("Separate past trips from future trips","Given [cutoff_day, trips], with rows [trip_id, day], return [training_ids, testing_ids]. Days before the cutoff go to training. Keep the original order within each group.",
                  "The cutoff day belongs to testing, even when trips arrive out of date order.",
                  ([8,[['b',8],['a',7],['c',9]]],[['a'],['b','c']]),([1,[]],[[],[]]),([5,[['z',5]]],[[],['z']])),
        challenge("Audit a split for identity leakage","Input is [training_rows, testing_rows], each row [visit_id,customer_id]. Return the sorted distinct customer IDs found in both splits. Repeated visits on only one side are allowed.",
                  "Separate the customer identity from the visit ID. A leak needs evidence from both sides.",
                  ([[['a','Jo'],['b','Mo']],[['c','Mo'],['d','Li']]],['Mo']),([[],[['x','Li']]],[]),([[['a','A'],['b','B']],[['p','B'],['q','A'],['r','A']]],['A','B']))
    ),
    "model-evaluation": (
        challenge("Measure false alarms and misses","Given [true_positives, false_positives, false_negatives], return [precision, recall]. Use None for any fraction with a zero denominator.",
                  "Precision uses flagged parcels. Recall uses actual damaged parcels.",
                  ([3,3,1],[0.5,0.75]),([0,0,2],[None,0]),([0,4,0],[0,None]),([0,0,0],[None,None])),
        challenge("Compare recall across service areas","Input is a list of [area, caught_faults, missed_faults]. Pool counts within each area, discard areas with zero actual faults and return the names tied for lowest recall in alphabetical order.",
                  "Sum counts before forming the fraction. An area with no positives has undefined recall.",
                  ([['A',1,1],['B',1,0],['A',0,1]],['A']),([['A',0,0]],[]),([['B',1,1],['A',2,2]],['A','B']),([],[]))
    ),
    "feature-engineering": (
        challenge("Build a past-only count","Given [target_route, prediction_day, events], count earlier delayed trips on that route. Each event is [route, day, delayed]. Trips on the prediction day are excluded.",
                  "Check route, time and delay status separately.",
                  (['A',5,[['A',4,True],['A',5,True],['B',2,True]]],1),(['B',5,[]],0),(['A',3,[['A',1,False],['A',2,True],['A',9,True]]],1)),
        challenge("Replay features without looking ahead","Each row is [day, route, delayed]. Return, in input order, how many delays on the same route occurred on strictly earlier days for each row. Input can be unsorted and several trips may share a day.",
                  "Trips on the same day cannot inform one another. Keep the original output positions.",
                  ([[3,'A',True],[1,'A',True],[3,'A',False],[2,'B',True]],[1,0,1,0]),([],[]),([[1,'A',True],[1,'A',True],[2,'A',False]],[0,0,2]))
    ),
    "overfitting": (
        challenge("Choose a validation checkpoint","Given rows [training_loss, validation_loss] in epoch order, return the one-based epoch with the smallest validation loss. Ties choose the earliest epoch. Return None if no epochs ran.",
                  "The smallest training error can occur later than the best validation error.",
                  ([[5,6],[3,3],[1,4]],2),([[2,2],[1,2]],1),([],None)),
        challenge("Implement early stopping","Given [patience, validation_losses], return the one-based first epoch at which the best loss has failed to improve for patience consecutive epochs. Equal loss is no improvement. Return None if training never stops. Patience is positive.",
                  "Reset the counter only when a new strict minimum is reached.",
                  ([2,[5,3,3,4]],4),([2,[4,5,2,3]],None),([1,[2,2]],2),([3,[]],None))
    ),
    "scikit-learn": (
        challenge("Use a fitted transformer","Given [training_minimum, training_maximum, new_values], return min-max scaled new_values using only the training limits. Values may fall outside [0,1]. For equal training limits return zeros.",
                  "Training determines the transformation. Reuse those constants for all new rows.",
                  ([10,30,[10,20,40]],[0,0.5,1.5]),([4,4,[1,9]],[0,0]),([0,2,[]],[])),
        challenge("Audit cross-validation preprocessing","Input rows are [fit_ids, train_ids, validation_ids] for separate folds. Return zero-based positions of folds where the transformer was fitted on anything other than exactly the distinct training IDs, or where training and validation IDs overlap.",
                  "Check set equality and disjointness independently inside each fold.",
                  ([[['a'],['a'],['b']],[['a','b'],['a'],['b']]],[1]),([[['a'],['a'],['a']]],[0]),([],[]),([[[],['x'],['y']]],[0]))
    ),
}

def extended_challenges(topic_id, base):
    result=[]
    for level,contract in zip(("Intermediate","Advanced"),CHALLENGES[topic_id]):
        tests=[{"input":value,"expected":expected,"label":"Sample" if i==0 else f"Boundary case {i}"} for i,(value,expected) in enumerate(contract.cases)]
        result.append({**base,"id":topic_id+"-"+level.lower(),"title":contract.title,"difficulty":level,
                       "prompt":contract.prompt,"hint":contract.hint,"sampleInput":tests[0]["input"],
                       "sampleOutput":tests[0]["expected"],"tests":tests})
    return result

