

#include "gpkg.h"

//void do_install(opkg_conf* conf, char* pkg_name, char* install_root_name, char* link_root_name, char** version_criteria)
void do_install(opkg_conf* conf, string_map* pkgs, char* install_root_name, char* link_root_name, int is_upgrade, int overwrite_config, int overwrite_other_package_files, char* tmp_root)
{


	string_map* package_data = initialize_string_map(1);
	string_map* matching_packages = initialize_string_map(1);
	unsigned long num_destroyed;

	char* install_root_path = (char*)get_string_map_element(conf->dest_names, install_root_name);
	char* overlay_path = (char*)get_string_map_element(conf->overlays, install_root_name);

	if(install_root_path == NULL)
	{
		printf("ERROR: No destination %s found, cannot install\n\n", install_root_name);
		exit(1);
	}
	

	/* Determine all packages to install by first loading all package names, status & dependencies (and no other variables) */
	load_all_package_data(conf, package_data, matching_packages, NULL, 1, LOAD_MINIMAL_PKG_VARIABLES, install_root_name );
	destroy_string_map(matching_packages, DESTROY_MODE_FREE_VALUES, &num_destroyed);
	
		



	/* determine list of all packiages we are about to install, including dependencies */
	string_map* install_pkgs_map = initialize_string_map(1);
	char** install_pkg_list = NULL;	
	unsigned long install_pkg_list_len = 0;
	char* unsatisfied_dep_err = NULL;
	
	//new string map var with all pkgs to install = pkgs, keys = version
	unsigned long num_pkg_names;
	char** pkg_names = get_string_map_keys(pkgs, &num_pkg_names);
	int pkg_name_index;
	for(pkg_name_index=0;pkg_name_index < num_pkg_names; pkg_name_index++)
	{
		char* pkg_name = pkg_names[pkg_name_index];
		char* install_pkg_version = NULL;
		int install_pkg_is_current;

		load_recursive_package_data_variables(package_data, pkg_name, 1, 0, 0); // load required-depends for package of interest only 
		char** version_criteria = get_string_map_element(pkgs, pkg_name);
		string_map* install_pkg_data = get_package_current_or_latest_matching(package_data, pkg_name, version_criteria, &install_pkg_is_current, &install_pkg_version);
		char* install_status = get_string_map_element(install_pkg_data, "Status");

	
		if(install_status != NULL)
		{
			char* old_el = set_string_map_element(install_pkgs_map, pkg_name, copy_null_terminated_string_array(version_criteria) );
			free_if_not_null(old_el);

			string_map* install_pkg_depend_map = get_string_map_element(install_pkg_data, "Required-Depends");
			if(install_pkg_depend_map != NULL)
			{
				unsigned long num_keys;
				char** load_detail_pkgs = get_string_map_keys(install_pkg_depend_map, &num_keys);
				int ldp_index;
				for(ldp_index=0;ldp_index < num_keys && unsatisfied_dep_err == NULL; ldp_index++)
				{
					char* dep_name = load_detail_pkgs[ldp_index];
					char** dep_def= get_string_map_element(install_pkg_depend_map, dep_name);
					char** old_dep_def = set_string_map_element(install_pkgs_map, dep_name, copy_null_terminated_string_array(dep_def));
					if(old_dep_def != NULL) { free_null_terminated_string_array(old_dep_def); }
	
					//error checking, check that dependency definition exists
					char* latest_version = NULL;
					int latest_is_current = 0;
					string_map* dep_info = get_package_current_or_latest_matching(package_data, dep_name, dep_def, &latest_is_current, &latest_version);
					
					
					//check if we have a version installed different than what is required
					int have_current;
					char* current_version = NULL;
					string_map* cur_info = get_package_current_or_latest(package_data, dep_name, &have_current, &current_version);
					if(have_current && (latest_is_current == 0 || dep_info == NULL))
					{
						//should only get here if dep_def[1] is not null (version mismatch doesn't make sense if no version is specified)
						char* cur_status = get_string_map_element(cur_info, "Status");
						if(strstr(cur_status, " hold ") != NULL)
						{
							unsatisfied_dep_err = dynamic_strcat(11, "ERROR: Dependency ", dep_name, " (", dep_def[0], " ", dep_def[1], ") of package ", pkg_name, " is installed,\n\t\tbut has incompatible version ", current_version, "and is marked as 'hold'");
						}
						else
						{
							unsatisfied_dep_err = dynamic_strcat(10, "ERROR: Dependency ", dep_name, " (", dep_def[0], " ", dep_def[1], ") of package ", pkg_name, " is installed,\n\t\tbut has incompatible version ", current_version);
						}
					}
					free_if_not_null(current_version);
					free_if_not_null(latest_version);
	
					// check that dependency definition exists
					if(unsatisfied_dep_err == NULL && dep_info == NULL)
					{
						if(dep_def[1] != NULL)
						{
							unsatisfied_dep_err = dynamic_strcat(9, "ERROR: Dependency ", dep_name, " (", dep_def[0], " ", dep_def[1], ") of package ", pkg_name, " cannot be found, try updating your package lists");
						}
						else
						{
							unsatisfied_dep_err = dynamic_strcat(5, "ERROR: Dependency ", dep_name, " of package ", pkg_name, " cannot be found, try updating your package lists");
						}
					}
									
				}
				free_null_terminated_string_array(load_detail_pkgs);
			}
	
		}
		install_status = get_string_map_element(install_pkg_data, "Status");
		char* will_fit = get_string_map_element(install_pkg_data, "Will-Fit");


		/* error checking before we start install */
		if(install_pkg_data == NULL || install_status == NULL)
		{
			fprintf(stderr, "ERROR: No package named %s found, try updating your package lists\n\n", pkg_name);
			exit(1);
		}
		if(install_status == NULL || strstr(install_status, " installed") != NULL)
		{
			fprintf(stderr, "WARNING: Package %s is already installed\n\n", pkg_name); 
		}

		if(unsatisfied_dep_err != NULL)
		{
			fprintf(stderr, "%s\n", unsatisfied_dep_err);
			exit(1);
		}
	}


	/* load more detailed data on packages we are about to install */
	free_recursive_package_vars(package_data); /* note: whacks install_pkg_depend_map */	
	string_map* parameters = initialize_string_map(1);
	matching_packages = initialize_string_map(1);
	set_string_map_element(parameters, "packages", install_pkgs_map);
	load_all_package_data(conf, package_data, matching_packages, parameters, 0, LOAD_ALL_PKG_VARIABLES, install_root_name);
	install_pkg_list = get_string_map_keys(matching_packages, &install_pkg_list_len);
	destroy_string_map(matching_packages, DESTROY_MODE_FREE_VALUES, &num_destroyed);
	destroy_string_map(parameters, DESTROY_MODE_IGNORE_VALUES, &num_destroyed);

	char* all_pkg_list_str = join_strs(", ", install_pkg_list, install_pkg_list_len, 0, 0); 
	uint64_t combined_size = 0;
	int pkg_index;

	for(pkg_index=0; pkg_index < install_pkg_list_len; pkg_index++)
	{
		char** match_criteria = get_string_map_element(install_pkgs_map, install_pkg_list[pkg_index]);
		string_map* pkg = get_package_current_or_latest_matching(package_data, install_pkg_list[pkg_index], match_criteria, NULL, NULL);
		char* next_size_str = get_string_map_element(pkg, "Installed-Size");
		uint64_t next_size = 0;
		if(sscanf(next_size_str,  SCANFU64, &next_size) > 0)
		{	
			combined_size = combined_size + next_size; 
		} 
	}
	uint64_t root_size = destination_bytes_free(conf, install_root_name);
	if(combined_size >= root_size )
	{
		fprintf(stderr, "ERROR: Not enough space in destination %s to install specified packages:\n\t%s\n\n", install_root_name, all_pkg_list_str);
		exit(1);
	}



	printf("Preparing to install the following packages, which will require " SCANFU64 " bytes:\n\t%s\n\n", combined_size, all_pkg_list_str);




	/* Set status of new required packages to half-installed, set user-installed on requested package, installed time on all */
	char* install_root_status_path = dynamic_strcat(2, install_root_path, "/usr/lib/opkg/status");
	string_map* install_root_status = initialize_string_map(1);
	matching_packages = initialize_string_map(1);
	if(path_exists(install_root_status_path))
	{
		load_package_data(install_root_status_path, 0, install_root_status, matching_packages, NULL, 1, LOAD_ALL_PKG_VARIABLES, install_root_name);
	}
	destroy_string_map(matching_packages, DESTROY_MODE_FREE_VALUES, &num_destroyed);




	time_t now = time(NULL);
	char install_time[20];
	sprintf(install_time, "%lu", now);
	for(pkg_index=0; pkg_index < install_pkg_list_len; pkg_index++)
	{
		int is_installed;
		char* install_version = NULL;
		char** match_criteria = get_string_map_element(install_pkgs_map, install_pkg_list[pkg_index]);
		string_map* pkg = get_package_current_or_latest_matching(package_data, install_pkg_list[pkg_index], match_criteria, &is_installed, &install_version);


		if(is_installed == 0) /* should never be true, but check anyway */
		{
			char* old_status = remove_string_map_element(pkg, "Status");
			free(old_status);
			char* status_parts[3] = { "install", "ok", "half-installed" };
			status_parts[1] = get_string_map_element(pkgs, install_pkg_list[pkg_index]) != NULL ? "user" : status_parts[1];
			char* new_status = dynamic_strcat(5, status_parts[0], " ", status_parts[1], " ", status_parts[2]);
			set_string_map_element(pkg, "Status", new_status);

			set_string_map_element(pkg, "Installed-Time", strdup(install_time));
			set_string_map_element(pkg, "Install-Destination", strdup(install_root_name));
			if(link_root_name != NULL)
			{
				set_string_map_element(pkg, "Link-Destination", strdup(link_root_name));
			}

			add_package_data(install_root_status, &pkg, install_pkg_list[pkg_index], install_version); 
			/* Note: we just added pkg data structure from package_data to install_root_status, Be careful on cleanup! */
		}
	}
	save_package_data_as_status_file(install_root_status, install_root_status_path);




	char* tmp_dir = (char*)malloc(1024);
	if(create_tmp_dir(tmp_root == NULL ? "/tmp" : tmp_root, &tmp_dir) != 0)
	{
		fprintf(stderr, "ERROR: Could not create tmp dir, exiting\n");
		exit(1);
	}
	

	string_map* install_called_pkgs = initialize_string_map(1);

	int err = 0;
	for(pkg_name_index=0;pkg_name_index < num_pkg_names; pkg_name_index++)
	{
		char* pkg_name = pkg_names[pkg_name_index];
		int install_pkg_is_current;
		char* install_pkg_version = NULL;
		char** version_criteria = get_string_map_element(pkgs, pkg_name);
		get_package_current_or_latest_matching(package_data, pkg_name, version_criteria, &install_pkg_is_current, &install_pkg_version);
		
		err = recursively_install(pkg_name, install_pkg_version, install_root_name, link_root_name, overlay_path, is_upgrade, overwrite_config, overwrite_other_package_files, tmp_dir, conf, package_data, install_called_pkgs);
		
		free_if_not_null(install_pkg_version);
	}
	

	if(err)
	{
		fprintf(stderr, "An error occurred during Installation, removing partially installed packages.\n");
		unsigned long num_install_called_pkgs;
		char** install_called_pkg_list = get_string_map_keys(install_called_pkgs, &num_install_called_pkgs);
		int pkg_index;
		for(pkg_index=0; pkg_index < num_install_called_pkgs; pkg_index++)
		{
			remove_individual_package(install_pkg_list[pkg_index], conf, package_data, tmp_dir, 0, 0);
		}
		free_null_terminated_string_array(install_called_pkg_list);
		//call remove function to do cleanup of partial install
		//DO NOT EXIT HERE, fixup status file below
	}
	//remove tmp dir -- need to do this whether or not there is an error
	rm_r(tmp_dir);
	free(tmp_dir);


	//set status of new packages to installed on success, and remove on failure
	for(pkg_index=0; pkg_index < install_pkg_list_len; pkg_index++)
	{	
		/* no need to check version, should only be one installed version at a time... */
		string_map* pkg = get_package_current_or_latest(install_root_status, install_pkg_list[pkg_index], NULL, NULL); 
		if(pkg != NULL)
		{
			if(!err)
			{
				char* status = get_string_map_element(pkg, "Status");
				if(strstr(status, " half-installed") != NULL)
				{
					char* status_parts[3] = { "install", "ok", "installed" };
					status_parts[1] = get_string_map_element(pkgs, install_pkg_list[pkg_index]) != NULL ? "user" : status_parts[1];
					char* new_status = dynamic_strcat(5, status_parts[0], " ", status_parts[1], " ", status_parts[2]);
					char* old_status = set_string_map_element(pkg, "Status", new_status);
					free_if_not_null(old_status);
				}
			}
			else
			{
				string_map* all_pkg_versions = remove_string_map_element(install_root_status, install_pkg_list[pkg_index]);
				free_all_package_versions(all_pkg_versions);
			}
		}
	}
	save_package_data_as_status_file(install_root_status, install_root_status_path);
	if(!err)
	{
		printf("Installation of packages successful.\n\n");
	}
	else
	{
		printf("Finished removing partially installed packages.\n\n");
	}

	
}


int recursively_install(char* pkg_name, char* pkg_version, char* install_root_name, char* link_to_root, char* overlay_path, int is_upgrade, int overwrite_config, int overwrite_other_package_files, char* tmp_dir, opkg_conf* conf, string_map* package_data, string_map* install_called_pkgs)
{
	int err=0;
	
	/* variables not allocated in this function, do not need to be freed */
	string_map* install_pkg_data    = get_package_with_version(package_data, pkg_name, pkg_version);
	char* src_id                    = get_string_map_element(install_pkg_data, "Source-ID");
	char* pkg_filename              = get_string_map_element(install_pkg_data, "Filename");
	string_map* pkg_dependencies    = get_string_map_element(install_pkg_data, "Required-Depends");
	char* install_root_path         = get_string_map_element(conf->dest_names, install_root_name);
	char* link_root_path            = link_to_root != NULL ? get_string_map_element(conf->dest_names, link_to_root) : NULL;
	char* base_url = NULL;
	
	/* variables that may need to be freed */
	char* pkg_dest = NULL;
	string_map* files_to_link = NULL;
	char* info_dir            = NULL;
	char* control_name_prefix = NULL;
	char* list_file_name      = NULL;
	string_map* conf_files    = NULL;
	string_map* copied_conf_files = NULL;

	int install_root_len = strlen(install_root_path);
	char* fs_terminated_install_root = install_root_path[install_root_len-1] == '/' ? strdup(install_root_path) : dynamic_strcat(2, install_root_path, "/");
	
	int overlay_root_len;
	char* fs_terminated_overlay_root = NULL;
	if(overlay_path != NULL)
	{
		overlay_root_len = strlen(overlay_path);
		fs_terminated_overlay_root = overlay_path[overlay_root_len-1] == '/' ? strdup(overlay_path) : dynamic_strcat(2, overlay_path, "/");
	}
	else
	{
		fs_terminated_overlay_root = strdup(fs_terminated_install_root);
	}

	int link_root_len;
	char* fs_terminated_link_root = NULL;
	if(link_root_path != NULL)
	{
		link_root_len = strlen(link_root_path);
		fs_terminated_link_root = link_root_path[link_root_len-1] == '/' ? strdup(link_root_path) : dynamic_strcat(2, link_root_path, "/");
	}
	set_string_map_element(install_called_pkgs, pkg_name, strdup("D"));


	if(pkg_dependencies != NULL)
	{
		//recurse
		unsigned long num_deps;
		char** deps = get_string_map_keys(pkg_dependencies, &num_deps);
		int dep_index;
		for(dep_index=0; err == 0 && dep_index < num_deps ; dep_index++)
		{
			if(get_string_map_element(install_called_pkgs, deps[dep_index]) == NULL )
			{
				char** dep_def = get_string_map_element(pkg_dependencies, deps[dep_index]);
				int is_current;
				char* matching_version;
				string_map* dep_pkg = get_package_current_or_latest_matching(package_data, deps[dep_index], dep_def, &is_current, &matching_version);

				if(dep_pkg != NULL)
				{
					char* dep_status = get_string_map_element(dep_pkg, "Status");
					if(strstr(dep_status, " half-installed") != NULL)
					{
						err = recursively_install(deps[dep_index], matching_version, install_root_name, link_to_root, overlay_path, is_upgrade, overwrite_config, overwrite_other_package_files, tmp_dir, conf, package_data, install_called_pkgs);
						
					}
				}
				else
				{
					err = 1;
				}
			}
		}
	}

	if(err == 0 && src_id == NULL || pkg_filename == NULL || install_root_path == NULL)
	{
		//sanity check
		err = 1;
	}
	if(err == 0)
	{
		printf("Preparing to install package %s...\n", pkg_name);
	}
	if(err == 0)
	{
		//determine source url
		string_map* src_lists[2] = { conf->gzip_sources, conf->plain_sources };
		int src_list_index;
		for(src_list_index=0; src_list_index < 2 && base_url == NULL; src_list_index++)
		{
			base_url = (char*)get_string_map_element(src_lists[src_list_index], src_id);
		}
		err = base_url == NULL ? 1 : err;
		if(err == 1)
		{
			fprintf(stderr, "ERROR: Could determine download  URL for package %s\n", pkg_name);
		}

	}

	if(err == 0)
	{
		
		//download package
		printf("\tDownloading...\n");
		char* src_url  = dynamic_strcat(3, base_url, "/", pkg_filename);
		pkg_dest = dynamic_strcat(3, tmp_dir, "/", pkg_name);
		FILE* package_file = fopen(pkg_dest, "w");
		if(package_file != NULL)
		{
			err = write_url_to_stream(src_url, "gpkg", NULL, package_file, NULL);
			fclose(package_file);
		}
		else
		{
			err = 1;
		}
		if(err == 1)
		{
			fprintf(stderr, "ERROR: Could not download package %s\n", pkg_name);
		}
		free(src_url);


	}
	if(err == 0)
	{
		//check md5sum
		char* md5sum = file_md5sum_alloc(pkg_dest);
		char* expected_md5sum = (char*)get_string_map_element(install_pkg_data, "MD5Sum");
		
		//printf("md5sum         = %s\n", md5sum);
		//printf("package md5sum = %s\n", (char*)get_string_map_element(install_pkg_data, "MD5Sum"));

		if(md5sum == NULL || expected_md5sum == NULL)
		{
			fprintf(stderr, "ERROR: Expected MD5Sum for %s not specified, cannot verify package\n", pkg_name);
			err = 1;
		}
		else if (safe_strcmp(md5sum, expected_md5sum) != 0)
		{
			fprintf(stderr, "ERROR: MD5Sum mismatch for %s package\n", pkg_name);
			err = 1;
		}
		else
		{
			printf("\tDownloaded %s successfully.\n\tInstalling %s...\n", pkg_name, pkg_name);
		}
		
		if(md5sum != NULL) { free(md5sum); }
		
	}
	if(err == 0)
	{
		// Extract list file contaiing list of files to install
		info_dir            = dynamic_strcat(2, fs_terminated_overlay_root, "/usr/lib/opkg/info");
		control_name_prefix = dynamic_strcat(4, info_dir, "/", pkg_name, ".");
		list_file_name      = dynamic_strcat(4, info_dir, "/", pkg_name, ".list");
		
		mkdir_p(info_dir, S_IRWXU | S_IRGRP | S_IXGRP | S_IROTH | S_IXOTH );
		FILE* list_file = fopen(list_file_name, "w");
		deb_extract(	pkg_dest,
				list_file,
				extract_quiet | extract_data_tar_gz | extract_list,
				NULL,
				NULL, 
				&err);
		fclose(list_file);
		if(err)
		{
			rm_r(list_file_name);
			fprintf(stderr, "ERROR: could not extract file list from packge %s.\n", pkg_name);
			fprintf(stderr, "       package file may be corrupt\n\n");
		}
	}
	if(err == 0)
	{
		//extract control files
		deb_extract(	pkg_dest,
				stderr,
				extract_control_tar_gz | extract_all_to_fs| extract_preserve_date | extract_unconditional,
				control_name_prefix, 
				NULL, 
				&err);
		if(err)
		{
			fprintf(stderr, "ERROR: could not extract control files from packge %s.\n", pkg_name);
			fprintf(stderr, "       package file may be corrupt\n\n");
		}

	}
	if(err == 0)
	{
		//check for file conflicts & correct list file to contain real root name in file paths
		unsigned long num_list_lines;
		char** list_file_lines = get_file_lines(list_file_name, &num_list_lines);


		char* conf_file_path = dynamic_strcat(4, info_dir, "/", pkg_name, ".conffiles");
		if(path_exists(conf_file_path))
		{
			unsigned long num_conf_lines;
			char** conf_file_lines =  get_file_lines(conf_file_path, &num_list_lines);
			int conf_line_index;
			conf_files = initialize_string_map(1);
			for(conf_line_index=0; conf_line_index < num_conf_lines; conf_line_index++)
			{
				set_string_map_element(conf_files, conf_file_lines[conf_line_index], strdup("D"));
			}
			free_null_terminated_string_array(conf_file_lines);
		}
		free(conf_file_path);

	

		FILE* list_file = fopen(list_file_name, "w");
		int line_index;
		for(line_index=0; line_index < num_list_lines && (!err) ; line_index++)
		{
			int line_len = strlen( list_file_lines[line_index] );
			if(line_len > 2)
			{
				if(list_file_lines[line_index][0] == '.' && list_file_lines[line_index][1] == '/' && list_file_lines[line_index][line_len-1] != '/')
				{
					char* adjusted_file_path = dynamic_strcat(2, fs_terminated_install_root, list_file_lines[line_index] + 2);
					int is_conf_file = conf_files != NULL ? 
								(get_string_map_element(conf_files, adjusted_file_path) != NULL ? 1 : 0) : 
								0;
					err = path_exists(adjusted_file_path) && is_conf_file == 0 && overwrite_other_package_files == 0 ? 1 : 0;
					if(err)
					{
						fprintf(stderr, "ERROR: file '%s'\n", adjusted_file_path);
						fprintf(stderr, "       from package %s already exists.\n\n", pkg_name);
					}
					else
					{
						fprintf(list_file, "%s\n", adjusted_file_path);
						if(link_root_path != NULL)
						{
							char* link_to_path = dynamic_strcat(2, fs_terminated_link_root, list_file_lines[line_index] + 2);
							files_to_link = files_to_link == NULL ? initialize_string_map(1) : files_to_link;
							set_string_map_element(files_to_link, adjusted_file_path, link_to_path);
							//don't free link_to_path, should be freed with files_to_link map
						}

						if(is_conf_file && path_exists(adjusted_file_path) && overwrite_config == 0)
						{
							char* tmp_conf_path = dynamic_strcat(2, tmp_dir, adjusted_file_path);
							mkdir_p(tmp_conf_path,  S_IRWXU | S_IRGRP | S_IXGRP | S_IROTH | S_IXOTH );
							rm_r(tmp_conf_path);
							rename(adjusted_file_path, tmp_conf_path);
							copied_conf_files = copied_conf_files == NULL ? initialize_string_map(1) : copied_conf_files;
							set_string_map_element(copied_conf_files, adjusted_file_path, tmp_conf_path);
							//don't free tmp_conf_path, should be freed with copied_conf_files map 
						}
					}
					free(adjusted_file_path);
	
				}
			}
		}
		fclose(list_file);
		if(list_file_lines != NULL) { free_null_terminated_string_array(list_file_lines); }
	}
	if(err == 0)
	{
		//run preinst
		err = run_script_if_exists(install_root_path, link_root_path, pkg_name, "preinst", (is_upgrade ? "upgrade" : "install") );
	}
	if(err == 0)
	{
		//extract package files
		deb_extract(	pkg_dest,
				stderr,
				extract_data_tar_gz | extract_all_to_fs| extract_preserve_date| extract_unconditional,
				fs_terminated_overlay_root, 
				NULL, 
				&err);
		if(err)
		{
			fprintf(stderr, "ERROR: could not extract application files from packge %s.\n", pkg_name);
			fprintf(stderr, "       package file may be corrupt\n\n");
		}

		//move any conf files back
		if(copied_conf_files != NULL)
		{
			unsigned long num_conf_paths;
			char** conf_paths = get_string_map_keys(copied_conf_files, &num_conf_paths);
			int conf_index;
			for(conf_index=0; conf_index < num_conf_paths; conf_index++)
			{
				char* tmp_conf_path = get_string_map_element(copied_conf_files, conf_paths[conf_index]);
				rm_r(conf_paths[conf_index]);
				rename(tmp_conf_path, conf_paths[conf_index]);
			}
			destroy_string_map(copied_conf_files, DESTROY_MODE_FREE_VALUES, &num_conf_paths);
			if(conf_paths != NULL ) { free_null_terminated_string_array(conf_paths); }
			copied_conf_files = NULL;
		}
	}
	if(err == 0 && files_to_link != NULL)
	{
		unsigned long num_files;
		char** real_files = get_string_map_keys(files_to_link, &num_files);
		int file_index;
		if(num_files > 0)
		{
			char* link_file_name = dynamic_strcat(4, info_dir, "/", pkg_name, ".linked");
			FILE* link_file = fopen(link_file_name, "w");
			for(file_index=0; link_file != NULL && file_index < num_files; file_index++)
			{
				char* link_path = get_string_map_element(files_to_link, real_files[file_index]);
				if(!path_exists(link_path))
				{
					mkdir_p(link_path, S_IRWXU | S_IRGRP | S_IXGRP | S_IROTH | S_IXOTH );
					rm_r(link_path);
					symlink(real_files[file_index], link_path);
					fprintf(link_file, "%s\n", link_path);
				}
			}
			if(link_file != NULL) { fclose(link_file); }
			free(link_file_name);
		}
		destroy_string_map(files_to_link, DESTROY_MODE_FREE_VALUES, &num_files);
		free_null_terminated_string_array(real_files);
		files_to_link = NULL;
	}
	if(err == 0)
	{
		//run postinst
		err = run_script_if_exists(install_root_path, link_root_path, pkg_name, "postinst", (is_upgrade ? "upgrade" : "install") );
	}
	if(err == 0)
	{
		// remove downloaded package file in tmp dir & print success
		rm_r(pkg_dest);
		printf("\tSuccessfully installed %s.\n", pkg_name);
	}


	//cleanup
	unsigned long num_destroyed;
	free_if_not_null(pkg_dest);
	free_if_not_null(info_dir);
	free_if_not_null(control_name_prefix);
	free_if_not_null(list_file_name);
	free_if_not_null(fs_terminated_install_root);
	free_if_not_null(fs_terminated_overlay_root);
	free_if_not_null(fs_terminated_link_root);
	if(files_to_link != NULL)   { destroy_string_map(files_to_link,     DESTROY_MODE_FREE_VALUES, &num_destroyed); }
	if(conf_files != NULL)      { destroy_string_map(conf_files,        DESTROY_MODE_FREE_VALUES, &num_destroyed); }
	if(copied_conf_files!= NULL){ destroy_string_map(copied_conf_files, DESTROY_MODE_FREE_VALUES, &num_destroyed); }




	return err;
}



