#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/types.h>


#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>

#include <erics_tools.h>
#include <uci.h>
#include <ipt_bwctl.h>
#define malloc safe_malloc
#define strdup safe_strdup

void restore_backup_for_id(char* id, char* quota_backup_dir);


void delete_chain_from_table(char* table, char* delete_chain);
void run_shell_command(char* command, int free_command_str);
void free_split_pieces(char** split_pieces);

list* get_all_sections_of_type(struct uci_context *ctx, char* package, char* section_type);
char* get_uci_option(struct uci_context* ctx,char* package_name, char* section_name, char* option_name);
char* get_option_value_string(struct uci_option* uopt);

int main(int argc, char** argv)
{

	char* wan_if = NULL;
	char* local_subnet = NULL;
	char* death_mark = NULL;
	char* death_mask = NULL;
	char* crontab_line = NULL;
	
	char c;
	while((c = getopt(argc, argv, "W:w:s:S:d:D:m:M:c:C:")) != -1) //section, page, css includes, javascript includes, title, output interface variables
	{
		switch(c)
		{
			case 'W':
			case 'w':
				wan_if = strdup(optarg);
				break;
			case 'S':
			case 's':
				local_subnet = strdup(optarg);
				break;
			case 'D':
			case 'd':
				death_mark = strdup(optarg);
				break;
			case 'M':
			case 'm':
				death_mask = strdup(optarg);
				break;
			case 'C':
			case 'c':
				crontab_line = strdup(optarg);
				break;

		}
	}

	/* even if parameters are wrong, whack old rules */
	char quota_table[] = "mangle";
	char crontab_dir[] = "/etc/crontabs/";
	char crontab_file_path[] = "/etc/crontabs/root";
	delete_chain_from_table(quota_table, "egress_quotas");
	delete_chain_from_table(quota_table, "ingress_quotas");
	delete_chain_from_table(quota_table, "combined_quotas");
	delete_chain_from_table(quota_table, "forward_quotas");
	delete_chain_from_table("nat", "quota_redirects");

	if(wan_if == NULL)
	{
		fprintf(stderr, "ERRROR: No wan interface specified\n");
		return 0;
	}
	if(local_subnet == NULL)
	{
		fprintf(stderr, "ERRROR: No local subnet specified\n");
		return 0;
	}
	if(death_mark == NULL)
	{
		fprintf(stderr, "ERRROR: No death mark specified\n");
		return 0;
	}
	if(death_mask == NULL)
	{
		fprintf(stderr, "ERRROR: No death mask specified\n");
		return 0;
	}



	struct uci_context *ctx = uci_alloc_context();
	struct uci_ptr ptr;

	list* quota_sections = get_all_sections_of_type(ctx, "firewall", "quota");
	if(quota_sections->length > 0)
	{
		run_shell_command(dynamic_strcat(3, "iptables -t ", quota_table, " -N forward_quotas 2>/dev/null"), 1);
		run_shell_command(dynamic_strcat(3, "iptables -t ", quota_table, " -N egress_quotas 2>/dev/null"), 1);
		run_shell_command(dynamic_strcat(3, "iptables -t ", quota_table, " -N ingress_quotas 2>/dev/null"), 1);
		run_shell_command(dynamic_strcat(3, "iptables -t ", quota_table, " -N combined_quotas 2>/dev/null"), 1);
		
		run_shell_command("iptables -t nat -N quota_redirects 2>/dev/null", 0);
		run_shell_command("iptables -t nat -A quota_redirects -j CONNMARK --set-mark 0x0/0xFF000000 2>/dev/null", 0);
		run_shell_command("iptables -t nat -I zone_lan_prerouting -j quota_redirects 2>/dev/null", 0);

		char* no_death_mark_test = dynamic_strcat(3, " -m connmark --mark 0x0/", death_mask, " ");
		run_shell_command(dynamic_strcat(6, "iptables -t ", quota_table, " -I INPUT  1 -i ", wan_if, no_death_mark_test, " -j ingress_quotas  2>/dev/null"), 1);
		run_shell_command(dynamic_strcat(6, "iptables -t ", quota_table, " -I INPUT  2 -i ", wan_if, no_death_mark_test, " -j combined_quotas 2>/dev/null"), 1);
		run_shell_command(dynamic_strcat(6, "iptables -t ", quota_table, " -I OUTPUT 1 -o ", wan_if, no_death_mark_test, " -j egress_quotas   2>/dev/null"), 1);
		run_shell_command(dynamic_strcat(6, "iptables -t ", quota_table, " -I OUTPUT 2 -o ", wan_if, no_death_mark_test, " -j combined_quotas 2>/dev/null"), 1);
	

		run_shell_command(dynamic_strcat(3, "iptables -t ", quota_table, " -I FORWARD -j forward_quotas 2>/dev/null"), 1);
		run_shell_command(dynamic_strcat(6, "iptables -t ", quota_table, " -A forward_quotas -o ", wan_if, no_death_mark_test, " -j egress_quotas  2>/dev/null"), 1);
		run_shell_command(dynamic_strcat(6, "iptables -t ", quota_table, " -A forward_quotas -i ", wan_if, no_death_mark_test, " -j ingress_quotas  2>/dev/null"), 1);
		run_shell_command(dynamic_strcat(6, "iptables -t ", quota_table, " -A forward_quotas -i ", wan_if, no_death_mark_test, " -j CONNMARK --set-mark 0x0F000000/0x0F000000  2>/dev/null"), 1);
		run_shell_command(dynamic_strcat(6, "iptables -t ", quota_table, " -A forward_quotas -o ", wan_if, no_death_mark_test, " -j CONNMARK --set-mark 0x0F000000/0x0F000000  2>/dev/null"), 1);
		run_shell_command(dynamic_strcat(3, "iptables -t ", quota_table, " -A forward_quotas -m connmark --mark 0x0F000000/0x0F000000 -j combined_quotas  2>/dev/null"), 1);
		run_shell_command(dynamic_strcat(3, "iptables -t ", quota_table, " -A forward_quotas -j CONNMARK --set-mark 0x0/0x0F000000  2>/dev/null"), 1);
		free(no_death_mark_test);

		run_shell_command(dynamic_strcat(5, "iptables -t ", quota_table, " -A egress_quotas   -j CONNMARK --set-mark 0x0/", death_mask, "  2>/dev/null"), 1);
		run_shell_command(dynamic_strcat(5, "iptables -t ", quota_table, " -A ingress_quotas  -j CONNMARK --set-mark 0x0/", death_mask, "  2>/dev/null"), 1);
		run_shell_command(dynamic_strcat(5, "iptables -t ", quota_table, " -A combined_quotas -j CONNMARK --set-mark 0x0/", death_mask, "  2>/dev/null"), 1);
		run_shell_command(dynamic_strcat(3, "iptables -t ", quota_table, " -A egress_quotas   -j CONNMARK --set-mark 0x0/0xFF000000 2>/dev/null"), 1);
		run_shell_command(dynamic_strcat(3, "iptables -t ", quota_table, " -A ingress_quotas  -j CONNMARK --set-mark 0x0/0xFF000000 2>/dev/null"), 1);
		run_shell_command(dynamic_strcat(3, "iptables -t ", quota_table, " -A combined_quotas -j CONNMARK --set-mark 0x0/0xFF000000 2>/dev/null"), 1);

		char* set_death_mark = dynamic_strcat(5, " -j CONNMARK --set-mark ", death_mark, "/", death_mask, " ");
		char* other_quota_section_name = NULL;
		unlock_bandwidth_semaphore_on_exit();
		while(quota_sections->length > 0 || other_quota_section_name != NULL)
		{
			char* next_quota = NULL;
			int process_other_quota = 0;
			if(quota_sections->length > 0)
			{
				next_quota = shift_list(quota_sections);
			}
			else
			{
				process_other_quota = 1;
				next_quota = other_quota_section_name;
				other_quota_section_name = NULL;
			}

			char* quota_enabled_var  = get_uci_option(ctx, "firewall", next_quota, "enabled");
			int enabled = 1;
			if(quota_enabled_var != NULL)
			{
				if(strcmp(quota_enabled_var, "0") == 0)
				{
					enabled = 0;
				}
			}
			free(quota_enabled_var);
			
			if(enabled)
			{
				char* ip = get_uci_option(ctx, "firewall", next_quota, "ip");
				if(ip == NULL) { ip = strdup("ALL"); }
				if(strlen(ip) == 0) { ip  = strdup("ALL"); }

				
				
				if( (strcmp(ip, "ALL_OTHERS_COMBINED") == 0 || strcmp(ip, "ALL_OTHERS_INDIVIDUAL") == 0) && (!process_other_quota)  )
				{
					other_quota_section_name = strdup(next_quota);
				}
				else
				{
					char* ignore_backup  = get_uci_option(ctx, "firewall", next_quota, "ignore_backup_at_next_restore");
					int do_restore = 1;
					if(ignore_backup != NULL)
					{
						do_restore = strcmp(ignore_backup, "1") == 0 ? 0 : 1;
						if(!do_restore)
						{
							//remove variable from uci 
							char* var_name = dynamic_strcat(3, "firewall.", next_quota, ".ignore_backup_at_next_restore");
							if (uci_lookup_ptr(ctx, &ptr, var_name, true) == UCI_OK)
							{
								uci_delete(ctx, &ptr);
							}
							free(var_name);
						}
					}
					free(ignore_backup);


					char* reset_interval = get_uci_option(ctx, "firewall", next_quota, "reset_interval");
					char* reset = strdup("");
					if(reset_interval != NULL)
					{
						char* reset_time     = get_uci_option(ctx, "firewall", next_quota, "reset_time");
						
						char* interval_option = strdup(" --reset_interval ");
						reset = dcat_and_free(&reset, &interval_option, 1, 1);
						reset = dcat_and_free(&reset, &reset_interval, 1, 1);
						if(reset_time != NULL)
						{
							char* reset_option = strdup(" --reset_time ");
							reset = dcat_and_free(&reset, &reset_option, 1, 1);
							reset = dcat_and_free(&reset, &reset_time, 1, 1);
						}
					}
				
					char* time_match_str = strdup("");	
					
					char* offpeak_hours     = get_uci_option(ctx, "firewall", next_quota, "offpeak_hours");
					char* offpeak_weekdays     = get_uci_option(ctx, "firewall", next_quota, "offpeak_weekdays");
					char* offpeak_weekly_ranges     = get_uci_option(ctx, "firewall", next_quota, "offpeak_weekly_ranges");

					char* onpeak_hours     = get_uci_option(ctx, "firewall", next_quota, "onpeak_hours");
					char* onpeak_weekdays     = get_uci_option(ctx, "firewall", next_quota, "onpeak_weekdays");
					char* onpeak_weekly_ranges     = get_uci_option(ctx, "firewall", next_quota, "onpeak_weekly_ranges");


					if(offpeak_hours != NULL || offpeak_weekdays != NULL || offpeak_weekly_ranges != NULL || onpeak_hours != NULL || onpeak_weekdays != NULL || onpeak_weekly_ranges != NULL)
					{
						unsigned char is_off_peak = (offpeak_hours != NULL || offpeak_weekdays != NULL || offpeak_weekly_ranges != NULL) ? 1 : 0;
						char* hours_var = is_off_peak ? offpeak_hours : onpeak_hours;
						char* weekdays_var = is_off_peak ? offpeak_weekdays : onpeak_weekdays;
						char* weekly_ranges_var = is_off_peak ? offpeak_weekly_ranges : onpeak_weekly_ranges;

						char *timerange_match = strdup(" -m timerange ! ");
						char *hour_match = strdup(" --hours \"");
						char *weekday_match = strdup(" --weekdays \"");
						char *weekly_match = strdup(" --weekly_ranges \"");
						char *quote_end = strdup("\" ");

						dcat_and_free(&time_match_str, &timerange_match,  1,1);
						if(hours_var != NULL && weekly_ranges_var == NULL)
						{
							dcat_and_free(&time_match_str, &hour_match, 1, 1);	
							dcat_and_free(&time_match_str, &hours_var, 1, 1);	
							dcat_and_free(&time_match_str, &quote_end, 1, 0);	
						}
						if(weekdays_var != NULL && weekly_ranges_var == NULL)
						{
							dcat_and_free(&time_match_str, &weekday_match, 1, 1);	
							dcat_and_free(&time_match_str, &weekdays_var, 1, 1);
							dcat_and_free(&time_match_str, &quote_end, 1, 0);	
						}
						if(weekly_ranges_var != NULL)
						{
							dcat_and_free(&time_match_str, &weekly_match, 1, 1);
							dcat_and_free(&time_match_str, &weekly_ranges_var, 1, 1);
							dcat_and_free(&time_match_str, &quote_end, 1, 0);
						}
						free(quote_end);
					}
					
					char* types[] = { "ingress_limit", "egress_limit", "combined_limit" };
					char* postfixes[] = { "_ingress", "_egress", "_combined" };
					char* chains[] =  { "ingress_quotas", "egress_quotas", "combined_quotas" };
					int type_index;
					for(type_index=0; type_index < 3; type_index++)
					{
						char** ip_egress_tests = NULL;
						char* applies_to = strdup("combined");
						char* subnet_definition = strdup("");

						char* limit = get_uci_option(ctx, "firewall", next_quota, types[type_index]);
					
						char* type_id = dynamic_replace(ip, "/", "_");
						type_id = dcat_and_free(&type_id, &(postfixes[type_index]), 1, 0);
						
						/* 
						 * need to do ip test even if limit is null, because ALL_OTHERS quotas should not apply when any of the three types of explicit limit is defined
						 * and we therefore need to use this test to set mark indicating an explicit quota has been checked
						 */
						char* ip_test = strdup(""); 
						if( strcmp(ip, "ALL_OTHERS_COMBINED") != 0 && strcmp(ip, "ALL_OTHERS_INDIVIDUAL") != 0 && strcmp(ip, "ALL") != 0 )
						{

							char* src_test = dynamic_strcat(3, " --src ", ip, " ");
							char* dst_test = dynamic_strcat(3, " --dst ", ip, " "); 
						
							if(strstr(ip, ",") != NULL || strstr(ip, " ") != NULL || strstr(ip, "\t") != NULL )
							{
								char ip_breaks[] = { ',', ' ', '\t' };
								unsigned long num_ips = 0;
								char** ip_list = split_on_separators(ip, ip_breaks, 3, -1, 0, &num_ips);
								unsigned long ip_index;
								for(ip_index=0; ip_index < num_ips; ip_index++)
								{
									char *next_ip = ip_list[ip_index];
									char *egress_test  = dynamic_strcat(3, " --src ", next_ip, " ");
									char *ingress_test = dynamic_strcat(3, " --dst ", next_ip, " ");
									if(strcmp(types[type_index], "egress_limit") == 0)
									{
										run_shell_command(dynamic_strcat(6, "iptables -t ", quota_table, " -A ", chains[type_index], egress_test, " -j CONNMARK --set-mark 0x0F000000/0x0F000000 2>/dev/null"), 1);
									}
									else if(strcmp(types[type_index], "ingress_limit") == 0)
									{
										run_shell_command(dynamic_strcat(6, "iptables -t ", quota_table, " -A ", chains[type_index], ingress_test, " -j CONNMARK --set-mark 0x0F000000/0x0F000000 2>/dev/null"), 1);
									}
									else if(strcmp(types[type_index], "combined_limit") == 0)
									{
										run_shell_command(dynamic_strcat(8, "iptables -t ", quota_table, " -A ", chains[type_index], " -i ", wan_if, ingress_test, " -j CONNMARK --set-mark 0x0F000000/0x0F000000 2>/dev/null"), 1);
										run_shell_command(dynamic_strcat(8, "iptables -t ", quota_table, " -A ", chains[type_index], " -o ", wan_if, egress_test, " -j CONNMARK --set-mark 0x0F000000/0x0F000000 2>/dev/null"), 1);
									}
									ip_list[ip_index] = egress_test;
									free(next_ip);
									free(ingress_test);
								}
								ip_egress_tests = ip_list;
								char* rule_end = strdup(" -m connmark --mark 0x0F000000/0x0F000000 ");
								ip_test = dcat_and_free(&ip_test, &rule_end, 1, 1);
							}
							else if(strcmp(types[type_index], "egress_limit") == 0)
							{
								ip_test=dcat_and_free(&ip_test, &src_test, 1, 0);
							}
							else if(strcmp(types[type_index], "ingress_limit") == 0)
							{
								ip_test=dcat_and_free(&ip_test, &dst_test, 1, 0);
							}
							else if(strcmp(types[type_index], "combined_limit") == 0)
							{
								run_shell_command(dynamic_strcat(8, "iptables -t ", quota_table, " -A ", chains[type_index], " -i ", wan_if, dst_test, " -j CONNMARK --set-mark 0x0F000000/0x0F000000 2>/dev/null"), 1);
								run_shell_command(dynamic_strcat(8, "iptables -t ", quota_table, " -A ", chains[type_index], " -o ", wan_if, src_test, " -j CONNMARK --set-mark 0x0F000000/0x0F000000 2>/dev/null"), 1);
								char* rule_end = strdup(" -m connmark --mark 0x0F000000/0x0F000000 ");
								ip_test = dcat_and_free(&ip_test, &rule_end, 1, 1);
							}
							run_shell_command(dynamic_strcat(6, "iptables -t ", quota_table, " -A ", chains[type_index], ip_test, " -j CONNMARK --set-mark 0xF0000000/0xF0000000 2>/dev/null"), 1);
							free(dst_test);
							free(src_test);
						}
						else if( strcmp(ip, "ALL_OTHERS_COMBINED") == 0 || strcmp(ip, "ALL_OTHERS_INDIVIDUAL") == 0 )
						{
							char* rule_end = strdup(" -m connmark --mark 0x0/0xF0000000 ");
							ip_test=dcat_and_free(&ip_test, &rule_end, 1, 1);
							if(strcmp(ip, "ALL_OTHERS_INDIVIDUAL") == 0)
							{
								free(applies_to);
								if(strcmp(types[type_index], "egress_limit") == 0)
								{
									char* subnet_test = dynamic_strcat(3, " -s ", local_subnet, " ");
									ip_test = dcat_and_free(&subnet_test, &ip_test, 1, 1);
									applies_to = strdup("individual_src");
								}
								else if(strcmp(types[type_index], "ingress_limit") == 0)
								{
									char* subnet_test = dynamic_strcat(3, " -d ", local_subnet, " ");
									ip_test = dcat_and_free(&subnet_test, &ip_test, 1, 1);
									applies_to = strdup("individual_dst");
								}
								else if(strcmp(types[type_index], "combined_limit") == 0)
								{
									applies_to = strdup("individual_local");
								}
									
								char *subnet_option = strdup(" --subnet ");
								subnet_definition = dcat_and_free(&subnet_definition, &subnet_option, 1, 1);
								subnet_definition = dcat_and_free(&subnet_definition, &local_subnet, 1, 0);
							}
						}
							
						if(limit != NULL)
						{
							//insert quota block rule
							run_shell_command(dynamic_strcat(15, "iptables -t ", quota_table, " -A ", chains[type_index], ip_test, time_match_str, " -m bandwidth --id \"", type_id, "\" --type ", applies_to, subnet_definition, " --greater_than ", limit, reset, set_death_mark), 1);
							if(strstr(ip_test, "connmark") != NULL)
							{
								run_shell_command(dynamic_strcat(5, "iptables -t ", quota_table, " -A ", chains[type_index], " -j CONNMARK --set-mark 0x0/0x0F000000 2>/dev/null"), 1);
							}
							
							//insert redirect rule
							if(strcmp(ip, "ALL") == 0 || strcmp(ip, "ALL_OTHERS_INDIVIDUAL") == 0)
							{
								char* check_str = (strcmp(types[type_index], "ingress_limit") == 0) ? strdup(" --check_with_src_dst_swap ") : strdup(" --check ");
								run_shell_command(dynamic_strcat(7, "iptables -t nat -A quota_redirects -p tcp ", time_match_str, " -m multiport --destination-port 80,443 -m bandwidth ", check_str, " --id \"", type_id, "\" -j REDIRECT "), 1);
								free(check_str);
							}
							else if(strcmp(ip, "ALL_OTHERS_COMBINED") == 0)
							{
								run_shell_command(dynamic_strcat(5, "iptables -t nat -A quota_redirects -p tcp ", time_match_str, " -m connmark --mark 0x0/0xF0000000 -m multiport --destination-port 80,443 -m bandwidth --check --id \"", type_id, "\" -j REDIRECT "), 1);
							}
							else
							{
								if(ip_egress_tests != NULL)
								{
									unsigned long egress_test_index;
									for(egress_test_index=0; ip_egress_tests[egress_test_index] != NULL; egress_test_index++ )
									{
										run_shell_command(dynamic_strcat(3, "iptables -t nat -A quota_redirects ", ip_egress_tests[egress_test_index], " -j CONNMARK --set-mark 0x0F000000/0x0F000000 2>/dev/null"), 1);
									}
								}
								else
								{
									run_shell_command(dynamic_strcat(3, "iptables -t nat -A quota_redirects --src ", ip, " -j CONNMARK --set-mark 0x0F000000/0x0F000000 2>/dev/null"), 1);
								}
								run_shell_command(dynamic_strcat(5, "iptables -t nat -A quota_redirects -p tcp ", time_match_str, " -m connmark --mark 0x0F000000/0x0F000000 -m multiport --destination-port 80,443 -m bandwidth --check --id \"", type_id, "\" -j REDIRECT "), 1);
								run_shell_command("iptables -t nat -A quota_redirects -m connmark --mark 0x0F000000/0x0F000000 -j CONNMARK --set-mark 0xF0000000/0xF0000000 2>/dev/null", 0);
								run_shell_command("iptables -t nat -A quota_redirects -m connmark --mark 0x0F000000/0x0F000000 -j CONNMARK --set-mark 0x0F000000/0x0F000000 2>/dev/null", 0);
							}


							//restore from backup
							if(do_restore)
							{
								restore_backup_for_id(type_id, "/usr/data/quotas");
							}
							free(limit);
						}
						free(ip_test);
						free(applies_to);
						free(subnet_definition);
						free(type_id);
						if(ip_egress_tests != NULL)
						{
							free_null_terminated_string_array(ip_egress_tests);
						}
					}
					free(time_match_str);
				}
				free(ip);
			}
			free(next_quota);

		}

		run_shell_command("iptables -t nat -A quota_redirects -j CONNMARK --set-mark 0x0/0xFF000000 2>/dev/null", 0);
		run_shell_command(dynamic_strcat(3,"iptables -t ", quota_table, " -A egress_quotas -j CONNMARK --set-mark 0x0/0xFF000000 2>/dev/null"), 1);
		run_shell_command(dynamic_strcat(3,"iptables -t ", quota_table, " -A ingress_quotas -j CONNMARK --set-mark 0x0/0xFF000000 2>/dev/null"), 1);
		run_shell_command(dynamic_strcat(3,"iptables -t ", quota_table, " -A combined_quotas -j CONNMARK --set-mark 0x0/0xFF000000 2>/dev/null"), 1);
		run_shell_command(dynamic_strcat(5,"iptables -t filter -I FORWARD -m connmark --mark ", death_mark, "/", death_mask, " -j REJECT 2>/dev/null"), 1);

		//make sure crontab is up to date
		if(crontab_line != NULL)
		{
			FILE* crontab_file = fopen(crontab_file_path,"r");
			int cron_line_found = 0;
			if(crontab_file == NULL)
			{
				run_shell_command(dynamic_strcat(2, "mkdir -p ", crontab_dir), 1);
			}
			else
			{
				unsigned long read_length;
				char* all_cron_data = (char*)read_entire_file(crontab_file, 2048, &read_length);
				fclose(crontab_file);

				unsigned long num_lines;
				char linebreaks[] = { '\n', '\r' };
				char** cron_lines = split_on_separators(all_cron_data, linebreaks, 2, -1, 0, &num_lines);
				int line_index = 0;
				for(line_index=0; line_index < num_lines && (!cron_line_found); line_index++)
				{
					if(strcmp(cron_lines[line_index], crontab_line) == 0)
					{
						cron_line_found = 1;
					}
				}
				free_null_terminated_string_array(cron_lines);
			}
			if(!cron_line_found)
			{
				crontab_file = fopen(crontab_file_path, "a");
				fprintf(crontab_file, "%s\n", crontab_line);
				fclose(crontab_file);
			}
		}
	}
	else
	{
		//remove crontab line if it exists
		FILE* crontab_file = fopen(crontab_file_path,"r");
		if(crontab_file != NULL)
		{
			unsigned long cron_line_found = 0;
			unsigned long read_length;
			unsigned long num_lines;
			char linebreaks[] = { '\n', '\r' };
			char* all_cron_data = (char*)read_entire_file(crontab_file, 2048, &read_length);
			fclose(crontab_file);
			char** cron_lines = split_on_separators(all_cron_data, linebreaks, 2, -1, 0, &num_lines);
			int line_index = 0;
			for(line_index=0; line_index < num_lines && (!cron_line_found); line_index++)
			{
				if(strcmp(cron_lines[line_index], crontab_line) == 0)
				{
					cron_line_found = 1;
				}
			}
			if(cron_line_found)
			{
				fopen(crontab_file_path, "w");
				for(line_index=0; line_index < num_lines && (!cron_line_found); line_index++)
				{
					if(strcmp(cron_lines[line_index], crontab_line) != 0)
					{
						fprintf(crontab_file, "%s\n", cron_lines[line_index]);
					}
				}
				fclose(crontab_file);
			}
			free_null_terminated_string_array(cron_lines);
		}
	}

	/* commit changes to uci, to remove ignore_backup_at_next_restore variables permanently */
	if (uci_lookup_ptr(ctx, &ptr, "firewall", true) == UCI_OK)
	{
		uci_commit(ctx, &ptr.p, false);
	}
	uci_free_context(ctx);

	return 0;
}

void restore_backup_for_id(char* id, char* quota_backup_dir)
{
	char* quota_file_name;
	if(strstr(id, "/") != NULL)
	{
		quota_file_name = dynamic_replace(id, "/", "_");
	}
	else
	{
		quota_file_name = strdup(id);
	}

	char* quota_file_path = dynamic_strcat(3, quota_backup_dir, "/quota_", quota_file_name);
	unsigned long num_ips = 0;
	time_t last_backup = 0;
	ip_bw* loaded_backup_data = load_usage_from_file(quota_file_path, &num_ips, &last_backup);
	if(loaded_backup_data != NULL)
	{
		set_bandwidth_usage_for_rule_id(id, 1, num_ips, last_backup, loaded_backup_data, 5000);
	}
	free(quota_file_path);
	free(quota_file_name);
}

void delete_chain_from_table(char* table, char* delete_chain)
{	
	char *command = dynamic_strcat(3, "iptables -t ", table, " -L --line-numbers 2>/dev/null");
	unsigned long num_lines = 0;
	char** table_dump = get_shell_command_output_lines(command, &num_lines );
	free(command);	

	unsigned long line_index;
	char* current_chain = NULL;
	list* delete_commands = initialize_list();


	for(line_index=0; line_index < num_lines; line_index++)
	{
		char* line = table_dump[line_index];
		unsigned long num_pieces = 0;
		char whitespace[] = { '\t', ' ', '\r', '\n' };
		char** line_pieces = split_on_separators(line, whitespace, 4, -1, 0, &num_pieces);
		if(strcmp(line_pieces[0], "Chain") == 0)
		{
			if(current_chain != NULL) { free(current_chain); }
			current_chain = strdup(line_pieces[1]);
		}
		else 
		{
			unsigned long line_num;
			int read = sscanf(line_pieces[0], "%ld", &line_num);

			if(read > 0 && current_chain != NULL && num_pieces >1)
			{
				if(strcmp(line_pieces[1], delete_chain) == 0)
				{
					char* delete_command = dynamic_strcat(7, "iptables -t ", table, " -D ", current_chain, " ", line_pieces[0], " 2>/dev/null");
					push_list(delete_commands, delete_command);
				}
			}
		}

		//free line_pieces
		free_null_terminated_string_array(line_pieces);
	}
	free_null_terminated_string_array(table_dump);
	
	/* final two commands to flush chain being deleted and whack it */
	unshift_list(delete_commands, dynamic_strcat(5, "iptables -t ", table, " -F ", delete_chain, " 2>/dev/null"));
	unshift_list(delete_commands, dynamic_strcat(5, "iptables -t ", table, " -X ", delete_chain, " 2>/dev/null"));

	/* run delete commands */
	while(delete_commands->length > 0)
	{
		char *next_command = (char*)pop_list(delete_commands);
		run_shell_command(next_command, 1);
	}

}

void run_shell_command(char* command, int free_command_str)
{
	//printf("%s\n", command);
	system(command);
	if(free_command_str)
	{
		free(command);
	}
}

list* get_all_sections_of_type(struct uci_context *ctx, char* package, char* section_type)
{

	struct uci_package *p = NULL;
	struct uci_element *e = NULL;

	list* sections_of_type = initialize_list();
	if(uci_load(ctx, package, &p) == UCI_OK)
	{
		uci_foreach_element( &p->sections, e)
		{
			struct uci_section *section = uci_to_section(e);
			if(safe_strcmp(section->type, section_type) == 0)
			{
				push_list(sections_of_type, strdup(section->e.name));
			}
		}
	}
	return sections_of_type;
}


char* get_uci_option(struct uci_context* ctx, char* package_name, char* section_name, char* option_name)
{
	char* option_value = NULL;
	struct uci_ptr ptr;
	char* lookup_str = dynamic_strcat(5, package_name, ".", section_name, ".", option_name);
	int ret_value = uci_lookup_ptr(ctx, &ptr, lookup_str, 1);
	if(ret_value == UCI_OK)
	{
		if( !(ptr.flags & UCI_LOOKUP_COMPLETE))
		{
			ret_value = UCI_ERR_NOTFOUND;
		}
		else
		{
			struct uci_element *e = (struct uci_element*)ptr.o;
			option_value = get_option_value_string(uci_to_option(e));
		}
	}
	free(lookup_str);

	return option_value;
}




// this function dynamically allocates memory for
// the option string, but since this program exits
// almost immediately (after printing variable info)
// the massive memory leak we're opening up shouldn't
// cause any problems.  This is your reminder/warning
// that this might be an issue if you use this code to
// do anything fancy.
char* get_option_value_string(struct uci_option* uopt)
{
	char* opt_str = NULL;
	if(uopt->type == UCI_TYPE_STRING)
	{
		opt_str = strdup(uopt->v.string);
	}
	if(uopt->type == UCI_TYPE_LIST)
	{
		struct uci_element* e;
		uci_foreach_element(&uopt->v.list, e)
		{
			if(opt_str == NULL)
			{
				opt_str = strdup(e->name);
			}
			else
			{
				char* tmp;
				tmp = dynamic_strcat(3, opt_str, " ", e->name);
				free(opt_str);
				opt_str = tmp;
			}
		}
	}

	return opt_str;
}


