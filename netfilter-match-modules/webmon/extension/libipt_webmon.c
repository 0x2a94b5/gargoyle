/*  webmon --	An iptables extension to match URLs in HTTP requests 
 *  		This module can match using string match or regular expressions
 *  		Originally designed for use with Gargoyle router firmware (gargoyle-router.com)
 *
 *
 *  Copyright © 2008-2010 by Eric Bishop <eric@gargoyle-router.com>
 * 
 *  This file is free software: you may copy, redistribute and/or modify it
 *  under the terms of the GNU General Public License as published by the
 *  Free Software Foundation, either version 2 of the License, or (at your
 *  option) any later version.
 *
 *  This file is distributed in the hope that it will be useful, but
 *  WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 *  General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */


#include <stdio.h>
#include <netdb.h>
#include <string.h>
#include <stdlib.h>
#include <getopt.h>

#include <arpa/inet.h>

/*
 * in iptables 1.4.0 and higher, iptables.h includes xtables.h, which
 * we can use to check whether we need to deal with the new requirements
 * in pre-processor directives below
 */
#include <iptables.h>  
#include <linux/netfilter_ipv4/ipt_webmon.h>

#ifdef _XTABLES_H
	#define iptables_rule_match	xtables_rule_match
	#define iptables_match		xtables_match
	#define iptables_target		xtables_target
	#define ipt_tryload		xt_tryload
#endif

/* 
 * XTABLES_VERSION_CODE is only defined in versions 1.4.1 and later, which
 * also require the use of xtables_register_match
 * 
 * Version 1.4.0 uses register_match like previous versions
 */
#ifdef XTABLES_VERSION_CODE 
	#define register_match          xtables_register_match
#endif


/* utility functions necessary for module to work across multiple iptables versions */
static int  my_check_inverse(const char option[], int* invert, int *my_optind, int argc);
static void param_problem_exit_error(char* msg);


char** split_on_separators(char* line, char* separators, int num_separators, int max_pieces, int include_remainder_at_max);
char* trim_flanking_whitespace(char* str);



/* Function which prints out usage message. */
static void help(void)
{
	printf(	"webmon options:\n");
}

static struct option opts[] = 
{
	{ .name = 0 }
};


/* Function which parses command options; returns true if it
   ate an option */
static int parse(	int c, 
			char **argv,
			int invert,
			unsigned int *flags,
#ifdef _XTABLES_H
			const void *entry,
#else
			const struct ipt_entry *entry,
			unsigned int *nfcache,
#endif			
			struct ipt_entry_match **match
			)
{
	struct ipt_webmon_info *info = (struct ipt_webmon_info *)(*match)->data;
	int valid_arg = 0;

		
	return valid_arg;

}


	
static void print_webmon_args(	struct ipt_webmon_info* info )
{
	
}

/* Final check; must have specified a test string with either --contains or --contains_regex. */
static void final_check(unsigned int flags)
{

}

/* Prints out the matchinfo. */
#ifdef _XTABLES_H
static void print(const void *ip, const struct xt_entry_match *match, int numeric)
#else	
static void print(const struct ipt_ip *ip, const struct ipt_entry_match *match, int numeric)
#endif
{
	printf("WEBMON ");
	struct ipt_webmon_info *info = (struct ipt_webmon_info *)match->data;

	print_webmon_args(info);
}

/* Saves the union ipt_matchinfo in parsable form to stdout. */
#ifdef _XTABLES_H
static void save(const void *ip, const struct xt_entry_match *match)
#else
static void save(const struct ipt_ip *ip, const struct ipt_entry_match *match)
#endif
{
	struct ipt_webmon_info *info = (struct ipt_webmon_info *)match->data;
	print_webmon_args(info);
}

static struct iptables_match webmon = 
{ 
	.next		= NULL,
 	.name		= "webmon",
	#ifdef XTABLES_VERSION_CODE
		.version = XTABLES_VERSION,
	#else
		.version = IPTABLES_VERSION,
	#endif
	.size		= IPT_ALIGN(sizeof(struct ipt_webmon_info)),
	.userspacesize	= IPT_ALIGN(sizeof(struct ipt_webmon_info)),
	.help		= &help,
	.parse		= &parse,
	.final_check	= &final_check,
	.print		= &print,
	.save		= &save,
	.extra_opts	= opts
};

void _init(void)
{
	register_match(&webmon);
}


#ifndef TRUE
#define TRUE 1
#endif
#ifndef FALSE
#define FALSE 0
#endif



void parse_ips_and_macs(char* addr_str, struct ipt_webmon_info *info)
{
	unsigned long num_pieces;
	char** addr_parts = split_on_separators(addr_str, ",", 1, -1, 0, &num_pieces);

	info->num_exclude_ips=0;
	info->num_exclude_ranges = 0;

	int ip_part_index;
	for(ip_part_index=0; addr_parts[ip_part_index] != NULL; ip_part_index++)
	{
		char* next_str = addr_parts[ip_part_index];
		if(strchr(next_str, '-') != NULL)
		{
			char** range_parts = split_on_separators(next_str, "-", 1, 2, 1, &num_pieces);
			char* start = trim_flanking_whitespace(range_parts[0]);
			char* end = trim_flanking_whitespace(range_parts[1]);
			int start_ip[4];
			int end_ip[4];
			int start_valid = sscanf(start, "%d.%d.%d.%d", start_ip, start_ip+1, start_ip+2, start_ip+3);
			int end_valid = sscanf(end, "%d.%d.%d.%d", end_ip, end_ip+1, end_ip+2, end_ip+3);
			
			if(start_valid == 4 && end_valid == 4)
			{
				struct ipt_webmon_ip_range r;
				struct in_addr sip, eip;
				inet_pton(AF_INET, start, &sip);
				inet_pton(AF_INET, end, &eip);
				r.start = (uint32_t)sip.s_addr;
				r.end   = (uint32_t)eip.s_addr;

				if(info->num_exclude_ranges <  WEBMON_MAX_IP_RANGES)
				{
					(info->exclude_ip_ranges)[ info->num_exclude_ranges ] = r;
					info->num_exclude_ranges = info->num_exclude_ranges + 1;
				}
			}

			free(start);
			free(end);	
			free(range_parts);
		}
		else
		{
			int parsed_ip[4];
			int valid = sscanf(next_str, "%d.%d.%d.%d", parsed_ip, parsed_ip+1, parsed_ip+2, parsed_ip+3);
			if(valid == 4)
			{
				struct in_addr ip;
				trim_flanking_whitespace(next_str);
				inet_pton(AF_INET, next_str, &ip);
				
				if(info->num_exclude_ranges <  WEBMON_MAX_IPS)
				{
					(info->exclude_ips)[ info->num_exclude_ips ] = (uint32_t)ip.s_addr;
					info->num_exclude_ips = info->num_exclude_ips + 1;
				}
			}
		}
		free(next_str);
	}
	free(addr_parts);
	
}




static void param_problem_exit_error(char* msg)
{
	#ifdef xtables_error
		xtables_error(PARAMETER_PROBLEM, msg);
	#else
		exit_error(PARAMETER_PROBLEM, msg);
	#endif
}



/*
 * line_str is the line to be parsed -- it is not modified in any way
 * max_pieces indicates number of pieces to return, if negative this is determined dynamically
 * include_remainder_at_max indicates whether the last piece, when max pieces are reached, 
 * 	should be what it would normally be (0) or the entire remainder of the line (1)
 * 	if max_pieces < 0 this parameter is ignored
 *
 *
 * returns all non-separator pieces in a line
 * result is dynamically allocated, MUST be freed after call-- even if 
 * line is empty (you still get a valid char** pointer to to a NULL char*)
 */
char** split_on_separators(char* line_str, char* separators, int num_separators, int max_pieces, int include_remainder_at_max)
{
	char** split;

	if(line_str != NULL)
	{
		int split_index;
		int non_separator_found;
		char* dup_line;
		char* start;

		if(max_pieces < 0)
		{
			/* count number of separator characters in line -- this count + 1 is an upperbound on number of pieces */
			int separator_count = 0;
			int line_index;
			for(line_index = 0; line_str[line_index] != '\0'; line_index++)
			{
				int sep_index;
				int found = 0;
				for(sep_index =0; found == 0 && sep_index < num_separators; sep_index++)
				{
					found = separators[sep_index] == line_str[line_index] ? 1 : 0;
				}
				separator_count = separator_count+ found;
			}
			max_pieces = separator_count + 1;
		}
		split = (char**)malloc((1+max_pieces)*sizeof(char*));
		split_index = 0;
		split[split_index] = NULL;


		dup_line = strdup(line_str);
		start = dup_line;
		non_separator_found = 0;
		while(non_separator_found == 0)
		{
			int matches = 0;
			int sep_index;
			for(sep_index =0; sep_index < num_separators; sep_index++)
			{
				matches = matches == 1 || separators[sep_index] == start[0] ? 1 : 0;
			}
			non_separator_found = matches==0 || start[0] == '\0' ? 1 : 0;
			if(non_separator_found == 0)
			{
				start++;
			}
		}

		while(start[0] != '\0' && split_index < max_pieces)
		{
			/* find first separator index */
			int first_separator_index = 0;
			int separator_found = 0;
			while(	separator_found == 0 )
			{
				int sep_index;
				for(sep_index =0; separator_found == 0 && sep_index < num_separators; sep_index++)
				{
					separator_found = separators[sep_index] == start[first_separator_index] || start[first_separator_index] == '\0' ? 1 : 0;
				}
				if(separator_found == 0)
				{
					first_separator_index++;
				}
			}
			
			/* copy next piece to split array */
			if(first_separator_index > 0)
			{
				char* next_piece = NULL;
				if(split_index +1 < max_pieces || include_remainder_at_max <= 0)
				{
					next_piece = (char*)malloc((first_separator_index+1)*sizeof(char));
					memcpy(next_piece, start, first_separator_index);
					next_piece[first_separator_index] = '\0';
				}
				else
				{
					next_piece = strdup(start);
				}
				split[split_index] = next_piece;
				split[split_index+1] = NULL;
				split_index++;
			}


			/* find next non-separator index, indicating start of next piece */
			start = start+ first_separator_index;
			non_separator_found = 0;
			while(non_separator_found == 0)
			{
				int matches = 0;
				int sep_index;
				for(sep_index =0; sep_index < num_separators; sep_index++)
				{
					matches = matches == 1 || separators[sep_index] == start[0] ? 1 : 0;
				}
				non_separator_found = matches==0 || start[0] == '\0' ? 1 : 0;
				if(non_separator_found == 0)
				{
					start++;
				}
			}
		}
		free(dup_line);
	}
	else
	{
		split = (char**)malloc((1)*sizeof(char*));
		split[0] = NULL;
	}
	return split;
}


char* trim_flanking_whitespace(char* str)
{
	int new_start = 0;
	int new_length = 0;

	char whitespace[5] = { ' ', '\t', '\n', '\r', '\0' };
	int num_whitespace_chars = 4;
	
	
	int str_index = 0;
	int is_whitespace = 1;
	int test;
	while( (test = str[str_index]) != '\0' && is_whitespace == 1)
	{
		int whitespace_index;
		is_whitespace = 0;
		for(whitespace_index = 0; whitespace_index < num_whitespace_chars && is_whitespace == 0; whitespace_index++)
		{
			is_whitespace = test == whitespace[whitespace_index] ? 1 : 0;
		}
		str_index = is_whitespace == 1 ? str_index+1 : str_index;
	}
	new_start = str_index;


	str_index = strlen(str) - 1;
	is_whitespace = 1;
	while( str_index >= new_start && is_whitespace == 1)
	{
		int whitespace_index;
		is_whitespace = 0;
		for(whitespace_index = 0; whitespace_index < num_whitespace_chars && is_whitespace == 0; whitespace_index++)
		{
			is_whitespace = str[str_index] == whitespace[whitespace_index] ? 1 : 0;
		}
		str_index = is_whitespace == 1 ? str_index-1 : str_index;
	}
	new_length = str[new_start] == '\0' ? 0 : str_index + 1 - new_start;
	

	if(new_start > 0)
	{
		for(str_index = 0; str_index < new_length; str_index++)
		{
			str[str_index] = str[str_index+new_start];
		}
	}
	str[new_length] = 0;
	return str;
}


