import os

def get_max_file_size(directory):
    max_size = float('-inf')
    max_file = None

    for root, dirs, files in os.walk(directory):
        for file in files:
            file_path_drc = os.path.join(root, file)
            file_size_drc = os.path.getsize(file_path_drc)

            file_path_jp = file_path_drc.replace("_drc0", "_jp00").replace("_qp08_qt06_cl10.drc", "_jp00.jpg")
            file_size_jp = os.path.getsize(file_path_jp)

            file_size_combined = file_size_drc + file_size_jp
            
            if file_size_combined > max_size:
                max_size = file_size_combined
                max_file = [file_path_drc, file_path_jp]

    return max_file, max_size


# Input directory of drc files
dir_paths = [
    'vsenseVVDB2/Matis_obj_Draco-Jpeg/Matis_drc0',
    'vsenseVVDB2/Rafa2_obj_Draco-Jpeg/Rafa2_drc0'
]

for directory_path in dir_paths:
    max_file, max_size = get_max_file_size(directory_path)

    if max_file:
        print(f"\nChecking dir: {directory_path}")
        print(f"The largest file pair is: {max_file}")
        print(f"Max. size across drc-jp file pairs of lowest level: {max_size} bytes")
    else:
        print("The directory is empty or contains no files.")