import pandas as pd
from pathlib import Path
# This program cleans the data for colleges by leaving only the college names, and removing all commas
# Program by Rise Akizaki

# relative filepath.
file_path = Path(__file__).resolve().parent.parent / "Clean_data" / "us_colleges_clean(OLD).csv"
df = pd.read_csv(file_path)
cdf = pd.DataFrame(columns=['college_name'])

file_height = len(df)

# Need to remove commas, it's messing with data entry.
def CleanData():
    for i in range(file_height):
        collegeName = df.loc[i, 'College Name']
        if "," in collegeName:
            collegeName = collegeName.replace(",", "")
        cdf.loc[i] = [collegeName]
    print("Finished cleaning college data")

CleanData()
output_path = Path(__file__).resolve().parent.parent / "Clean_data" / "colleges_clean.csv"
cdf.to_csv(output_path, index = False) # index = False prevents indices from being the first column

print("Copy of cleaned courses saved to " + str(output_path))
