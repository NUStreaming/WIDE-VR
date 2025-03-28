import os
import json

directories_list = [
    'vsenseVVDB2_600f/Matis_obj_Draco-Jpeg/Matis_drc0',
    'vsenseVVDB2_600f/Matis_obj_Draco-Jpeg/Matis_drc1',
    # 'vsenseVVDB2_600f/Matis_obj_Draco-Jpeg/Matis_drc2',
    'vsenseVVDB2_600f/Matis_obj_Draco-Jpeg/Matis_drc3',
    'vsenseVVDB2_600f/Matis_obj_Draco-Jpeg/Matis_drc4',
    # 'vsenseVVDB2_600f/Matis_obj_Draco-Jpeg/Matis_drc5',
    'vsenseVVDB2_600f/Matis_obj_Draco-Jpeg/Matis_jp00',
    # 'vsenseVVDB2_600f/Matis_obj_Draco-Jpeg/Matis_jp05',
    'vsenseVVDB2_600f/Matis_obj_Draco-Jpeg/Matis_jp10',
    'vsenseVVDB2_600f/Matis_obj_Draco-Jpeg/Matis_jp30',
    'vsenseVVDB2_600f/Matis_obj_Draco-Jpeg/Matis_jp55',
    'vsenseVVDB2_600f/Rafa2_obj_Draco-Jpeg/Rafa2_drc0',
    'vsenseVVDB2_600f/Rafa2_obj_Draco-Jpeg/Rafa2_drc1',
    # 'vsenseVVDB2_600f/Rafa2_obj_Draco-Jpeg/Rafa2_drc2',
    'vsenseVVDB2_600f/Rafa2_obj_Draco-Jpeg/Rafa2_drc3',
    'vsenseVVDB2_600f/Rafa2_obj_Draco-Jpeg/Rafa2_drc4',
    # 'vsenseVVDB2_600f/Rafa2_obj_Draco-Jpeg/Rafa2_drc5',
    'vsenseVVDB2_600f/Rafa2_obj_Draco-Jpeg/Rafa2_jp00',
    # 'vsenseVVDB2_600f/Rafa2_obj_Draco-Jpeg/Rafa2_jp05',
    'vsenseVVDB2_600f/Rafa2_obj_Draco-Jpeg/Rafa2_jp10',
    'vsenseVVDB2_600f/Rafa2_obj_Draco-Jpeg/Rafa2_jp30',
    'vsenseVVDB2_600f/Rafa2_obj_Draco-Jpeg/Rafa2_jp55'
]

def get_files_sizes(directories):
    files_info = {}
    
    # Loop through each directory
    for directory in directories:
        if os.path.exists(directory):
            # Loop through all files in the directory
            for root, dirs, files in os.walk(directory):
                for file in files:

                    file_path = os.path.join(root, file)
                    file_size = os.path.getsize(file_path)
                    # print(file_path)
                    # print(file_size)

                    files_info[file_path] = file_size
        else:
            print(f"Directory not found: {directory}")
    
    return files_info

def write_to_js_file(data, output_file):
    with open(output_file, 'w') as js_file:
        js_file.write("const fileSizesByFilePath = {\n")
        for file_path, size in data.items():
            js_file.write(f"  '{file_path}': {size},\n")
        js_file.write("};\n")
        js_file.write("module.exports = { fileSizesByFilePath };\n")

if __name__ == "__main__":
    
    output_file_path = 'filepath_to_size_mapping_600f.js'
    
    # Get file sizes from the directories
    file_sizes = get_files_sizes(directories_list)
    
    # Write the file sizes to a JS file
    write_to_js_file(file_sizes, output_file_path)
    
    print(f"File sizes have been saved to {output_file_path}")