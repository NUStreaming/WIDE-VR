import os
import shutil


# Total number of files to generate
total_files = 1200  ## USER INPUT (should be multiples of 300) ##
# Number of files in each cycle
cycle_length = 300

# Path to the folder containing the original 300 files
input_folder = '/Users/maylim/Research/vv-streaming/AdaptiveStreamingForVV/server/nginx/static/media/vsenseVVDB2/Matis_obj_Draco-Jpeg/Matis_jp55'  ## USER INPUT ##
# Path to the folder where the new 6000 files will be saved
output_folder = f'/Users/maylim/Research/vv-streaming/AdaptiveStreamingForVV/server/nginx/static/media/vsenseVVDB2_{total_files}f/{input_folder.split('/')[-2]}/{input_folder.split('/')[-1]}'

# To verify folder paths before continuing
print(f"\ninput_folder: {input_folder}")
print(f"output_folder: {output_folder}\n")
if input("Do you wish to continue? [y/n] ") == "y":
    pass
else:
    exit()

# Create output folder if it doesn't exist
if not os.path.exists(output_folder):
    os.makedirs(output_folder)

# Get list of file names and sort them
file_names = sorted(os.listdir(input_folder))

# Verify we have exactly 300 files
assert len(file_names) == 300, "The input folder must contain exactly 300 files."

# Duplicate files with inverted order for each set
for cycle in range(total_files // cycle_length):
    for i in range(cycle_length):
        if cycle % 2 == 0:
            # Normal order
            source_index = i
        else:
            # Inverted order
            source_index = cycle_length - 1 - i
        
        original_file_path = os.path.join(input_folder, file_names[source_index])
        original_file_name_arr = file_names[source_index].split('_')
        output_file_number = cycle * cycle_length + i + 1
        output_file_name = f'{original_file_name_arr[0]}_{output_file_number:05d}_{"_".join(original_file_name_arr[2:])}'
        output_file_path = os.path.join(output_folder, output_file_name)

        # print("################ [debug]")
        # print(original_file_path)
        # print(output_file_path)
        # exit()
        
        # Copy the file to the new location
        shutil.copy2(original_file_path, output_file_path)

print("Files duplicated and saved successfully.")