import os

def get_avg_file_size(directory):
    avg_size = float('inf')
    total_file_size = 0
    count = 0

    for root, dirs, files in os.walk(directory):
        for file in files:
            file_path_drc = os.path.join(root, file)
            file_size_drc = os.path.getsize(file_path_drc)

            if "_drc0" in file_path_drc:
                file_path_jp = file_path_drc.replace("_drc0", "_jp00").replace("_qp08_qt06_cl10.drc", "_jp00.jpg")
            elif "_drc1" in file_path_drc:
                file_path_jp = file_path_drc.replace("_drc1", "_jp10").replace("_qp10_qt10_cl10.drc", "_jp10.jpg")
            elif "_drc3" in file_path_drc:
                file_path_jp = file_path_drc.replace("_drc3", "_jp30").replace("_qp12_qt10_cl10.drc", "_jp30.jpg")
            elif "_drc4" in file_path_drc:
                file_path_jp = file_path_drc.replace("_drc4", "_jp55").replace("_qp12_qt12_cl10.drc", "_jp55.jpg")
            else:
                continue

            file_size_jp = os.path.getsize(file_path_jp)

            file_size_combined = file_size_drc + file_size_jp
            
            # print(file_path_drc)
            # print(file_path_jp)
            # print(file_size_combined)
            # print("--")

            total_file_size += file_size_combined
            count += 1
         
    avg_size = total_file_size/count
    return avg_size


# Input directory of drc files
dir_paths = [
    'vsenseVVDB2/Matis_obj_Draco-Jpeg',
    'vsenseVVDB2/Rafa2_obj_Draco-Jpeg'
]

for directory_path in dir_paths:
    avg_size = get_avg_file_size(directory_path)

    if avg_size:
        print(f"\nChecking dir: {directory_path}")
        print(f"Avg. size across drc-jp file pairs of all levels: {avg_size} bytes")
    else:
        print("The directory is empty or contains no files.")