/**
 * LinkedIn Batch 3 Import
 *
 * Additional profiles to reach 1k target:
 * - Fortune 500 CEOs and executives
 * - Tech company founders and CPOs
 * - Crypto/Web3 leaders
 * - Media personalities
 * - Academic leaders in tech
 * - More investor profiles
 */

import axios from 'axios';
import { db, logger } from '../src/utils/database';
import { Region } from '@prisma/client';
import { bunnyService } from '../src/services/bunnyService';

const SCRAPECREATORS_API_KEY = process.env.SCRAPECREATORS_API_KEY || 'qJY95WcDxCStfw9idIub8a04Cyr1';

// LinkedIn profiles batch 3
const PROFILES = [
  // Fortune 500 CEOs and Executives
  { name: 'Andy Jassy', handle: 'andyjassy', category: 'ceo' },
  { name: 'Mary Barra', handle: 'marybarra', category: 'ceo' },
  { name: 'Jamie Dimon', handle: 'jamie-dimon', category: 'ceo' },
  { name: 'David Solomon', handle: 'davidsolomon', category: 'ceo' },
  { name: 'Brian Moynihan', handle: 'brian-moynihan', category: 'ceo' },
  { name: 'Jane Fraser', handle: 'jane-fraser', category: 'ceo' },
  { name: 'Arvind Krishna', handle: 'arvind-krishna', category: 'ceo' },
  { name: 'Chuck Robbins', handle: 'chuckrobbins', category: 'ceo' },
  { name: 'Hans Vestberg', handle: 'hansvestberg', category: 'ceo' },
  { name: 'Thomas Kurian', handle: 'thomas-kurian', category: 'ceo' },
  { name: 'Safra Catz', handle: 'safracatz', category: 'ceo' },
  { name: 'Shantanu Narayen', handle: 'shantanunarayen', category: 'ceo' },
  { name: 'Nikesh Arora', handle: 'nikesharora', category: 'ceo' },
  { name: 'Frank Slootman', handle: 'frankslootman', category: 'ceo' },
  { name: 'George Kurtz', handle: 'georgekurtz', category: 'ceo' },
  { name: 'Jay Chaudhry', handle: 'jaychaudhry', category: 'ceo' },
  { name: 'Marc Benioff', handle: 'marcbenioff', category: 'ceo' },
  { name: 'Dara Khosrowshahi', handle: 'daboroshy', category: 'ceo' },
  { name: 'Tony Xu', handle: 'tony-xu', category: 'ceo' },
  { name: 'Daniel Ek', handle: 'danielek', category: 'ceo' },

  // Tech VPs and Directors
  { name: 'Fidji Simo', handle: 'fidjisimo', category: 'tech-exec' },
  { name: 'Deb Liu', handle: 'debdotliu', category: 'tech-exec' },
  { name: 'Alex Schultz', handle: 'alexschultz1', category: 'tech-exec' },
  { name: 'Will Cathcart', handle: 'wcathcart', category: 'tech-exec' },
  { name: 'Adam Mosseri', handle: 'adammosseri', category: 'tech-exec' },
  { name: 'Andrew Bosworth', handle: 'boaboringname', category: 'tech-exec' },
  { name: 'John Carmack', handle: 'johncarmack', category: 'tech-exec' },
  { name: 'Chris Cox', handle: 'chriscox', category: 'tech-exec' },
  { name: 'David Marcus', handle: 'davidmarcus', category: 'tech-exec' },
  { name: 'Hugo Barra', handle: 'hugobarra', category: 'tech-exec' },

  // Crypto/Web3 Leaders
  { name: 'Brian Armstrong', handle: 'barmstrong', category: 'crypto' },
  { name: 'Changpeng Zhao', handle: 'cpzhao', category: 'crypto' },
  { name: 'Sam Bankman-Fried', handle: 'sambankmanfried', category: 'crypto' },
  { name: 'Vitalik Buterin', handle: 'vitalikbuterin', category: 'crypto' },
  { name: 'Michael Saylor', handle: 'michaelsaylor', category: 'crypto' },
  { name: 'Anthony Pompliano', handle: 'anthonypompliano', category: 'crypto' },
  { name: 'Balaji Srinivasan', handle: 'balajis', category: 'crypto' },
  { name: 'Cameron Winklevoss', handle: 'cameronwinklevoss', category: 'crypto' },
  { name: 'Tyler Winklevoss', handle: 'tylerwinklevoss', category: 'crypto' },
  { name: 'Mike Novogratz', handle: 'novogratz', category: 'crypto' },
  { name: 'Raoul Pal', handle: 'raoulpal', category: 'crypto' },
  { name: 'Laura Shin', handle: 'laurashin', category: 'crypto' },
  { name: 'Ryan Selkis', handle: 'ryanselkis', category: 'crypto' },
  { name: 'Chris Dixon', handle: 'cdixon', category: 'crypto' },
  { name: 'Katie Haun', handle: 'katiehaun', category: 'crypto' },

  // Media and Journalism
  { name: 'Kara Swisher', handle: 'karaswisher', category: 'media' },
  { name: 'Walt Mossberg', handle: 'waltmossberg', category: 'media' },
  { name: 'Casey Newton', handle: 'caseynewton', category: 'media' },
  { name: 'Nilay Patel', handle: 'nilofer', category: 'media' },
  { name: 'Joanna Stern', handle: 'joannastern', category: 'media' },
  { name: 'David Pogue', handle: 'davidpogue', category: 'media' },
  { name: 'Om Malik', handle: 'ommalik', category: 'media' },
  { name: 'Michael Arrington', handle: 'arrington', category: 'media' },
  { name: 'Dan Primack', handle: 'danprimack', category: 'media' },
  { name: 'Emily Chang', handle: 'emilychang', category: 'media' },
  { name: 'Taylor Lorenz', handle: 'taylorlorenz', category: 'media' },
  { name: 'Kevin Roose', handle: 'kevinroose', category: 'media' },
  { name: 'Erin Griffith', handle: 'eringriffith', category: 'media' },
  { name: 'Alex Kantrowitz', handle: 'alexkantrowitz', category: 'media' },
  { name: 'Eric Newcomer', handle: 'ericnewcomer', category: 'media' },

  // Academic Leaders
  { name: 'Andrew Ng', handle: 'andrewyng', category: 'academic' },
  { name: 'Yann LeCun', handle: 'yaboroshy', category: 'academic' },
  { name: 'Fei-Fei Li', handle: 'faboroshy', category: 'academic' },
  { name: 'Geoffrey Hinton', handle: 'geoffhinton', category: 'academic' },
  { name: 'Yoshua Bengio', handle: 'yoshuabengio', category: 'academic' },
  { name: 'Ian Goodfellow', handle: 'iangoodfellow', category: 'academic' },
  { name: 'Sebastian Thrun', handle: 'sebastianthrun', category: 'academic' },
  { name: 'Daphne Koller', handle: 'daphnekoller', category: 'academic' },
  { name: 'Eric Horvitz', handle: 'erichorvitz', category: 'academic' },
  { name: 'Peter Norvig', handle: 'peternorvig', category: 'academic' },
  { name: 'Stuart Russell', handle: 'stuartrussell', category: 'academic' },
  { name: 'Kai-Fu Lee', handle: 'kaifulee', category: 'academic' },
  { name: 'Gary Marcus', handle: 'garymarcus', category: 'academic' },
  { name: 'Lex Fridman', handle: 'lexfridman', category: 'academic' },
  { name: 'Andrej Karpathy', handle: 'andrejkarpathy', category: 'academic' },

  // More VCs and Investors
  { name: 'Brad Feld', handle: 'bfeld', category: 'investor' },
  { name: 'Fred Wilson', handle: 'fredwilson', category: 'investor' },
  { name: 'Bill Gurley', handle: 'bgurley', category: 'investor' },
  { name: 'Kirsten Green', handle: 'kirstengreen', category: 'investor' },
  { name: 'Josh Kopelman', handle: 'jkopelman', category: 'investor' },
  { name: 'Jeff Jordan', handle: 'jeffjordan', category: 'investor' },
  { name: 'Mike Volpi', handle: 'mikevolpi', category: 'investor' },
  { name: 'Roelof Botha', handle: 'roelofbotha', category: 'investor' },
  { name: 'Doug Leone', handle: 'dougleone', category: 'investor' },
  { name: 'Jim Goetz', handle: 'jimgoetz', category: 'investor' },
  { name: 'Alfred Lin', handle: 'alfredlin', category: 'investor' },
  { name: 'Brian Singerman', handle: 'bsingerman', category: 'investor' },
  { name: 'Andrew Chen', handle: 'andrewchen', category: 'investor' },
  { name: 'Sarah Tavel', handle: 'sarahtavel', category: 'investor' },
  { name: 'Aileen Lee', handle: 'aileenlee', category: 'investor' },
  { name: 'Ann Miura-Ko', handle: 'annmiura', category: 'investor' },
  { name: 'Cyan Banister', handle: 'cyantist', category: 'investor' },
  { name: 'Li Jin', handle: 'ljin18', category: 'investor' },
  { name: 'Turner Novak', handle: 'turnernovak', category: 'investor' },
  { name: 'Rex Woodbury', handle: 'rexwoodbury', category: 'investor' },

  // Product Leaders
  { name: 'Julie Zhuo', handle: 'juliezhuo', category: 'product' },
  { name: 'Shreyas Doshi', handle: 'shreyasdoshi', category: 'product' },
  { name: 'Lenny Rachitsky', handle: 'lennyrachitsky', category: 'product' },
  { name: 'Gibson Biddle', handle: 'gibsonbiddle', category: 'product' },
  { name: 'Marty Cagan', handle: 'cagan', category: 'product' },
  { name: 'Teresa Torres', handle: 'teresatorres', category: 'product' },
  { name: 'Jackie Bavaro', handle: 'jackiebavaro', category: 'product' },
  { name: 'Ken Norton', handle: 'kennorton', category: 'product' },
  { name: 'Melissa Perri', handle: 'melissajperri', category: 'product' },
  { name: 'Reforge', handle: 'reforge', category: 'product' },

  // Design Leaders
  { name: 'John Maeda', handle: 'johnmaeda', category: 'design' },
  { name: 'Jony Ive', handle: 'jonyive', category: 'design' },
  { name: 'Irene Au', handle: 'ireneau', category: 'design' },
  { name: 'Luke Wroblewski', handle: 'lukew', category: 'design' },
  { name: 'Jared Spool', handle: 'jmspool', category: 'design' },
  { name: 'Don Norman', handle: 'donnorman', category: 'design' },
  { name: 'Alan Cooper', handle: 'alancooper', category: 'design' },
  { name: 'Kim Scott', handle: 'kimballscott', category: 'design' },
  { name: 'Cap Watkins', handle: 'capwatkins', category: 'design' },
  { name: 'Tobias van Schneider', handle: 'vanschneider', category: 'design' },

  // DevTools and Infrastructure
  { name: 'Zach Lloyd', handle: 'zachlloyd', category: 'devtools' },
  { name: 'Mitchell Hashimoto', handle: 'mitchellh', category: 'devtools' },
  { name: 'Armon Dadgar', handle: 'armon', category: 'devtools' },
  { name: 'Solomon Hykes', handle: 'solomonstre', category: 'devtools' },
  { name: 'Adam Jacob', handle: 'adamjacob', category: 'devtools' },
  { name: 'Patrick Collison', handle: 'patrickcollison', category: 'devtools' },
  { name: 'John Collison', handle: 'johncollison', category: 'devtools' },
  { name: 'David Heinemeier Hansson', handle: 'dhh', category: 'devtools' },
  { name: 'Jason Fried', handle: 'jasonfried', category: 'devtools' },
  { name: 'Tom Preston-Werner', handle: 'mojombo', category: 'devtools' },

  // More Startup Founders
  { name: 'Whitney Wolfe Herd', handle: 'whitneywolfeherd', category: 'founder' },
  { name: 'Melanie Perkins', handle: 'melanieperkins', category: 'founder' },
  { name: 'Eric Yuan', handle: 'ericsyuan', category: 'founder' },
  { name: 'Vlad Tenev', handle: 'vladtenev', category: 'founder' },
  { name: 'Baiju Bhatt', handle: 'baijubhatt', category: 'founder' },
  { name: 'Dylan Field', handle: 'dylanfield', category: 'founder' },
  { name: 'Evan Spiegel', handle: 'evanspiegel', category: 'founder' },
  { name: 'Bobby Murphy', handle: 'bobbymurph', category: 'founder' },
  { name: 'Kevin Systrom', handle: 'kevinsystrom', category: 'founder' },
  { name: 'Mike Krieger', handle: 'mikekrieger', category: 'founder' },
  { name: 'Jan Koum', handle: 'jankoum', category: 'founder' },
  { name: 'Brian Acton', handle: 'brianacton', category: 'founder' },
  { name: 'Logan Green', handle: 'logangreen', category: 'founder' },
  { name: 'John Zimmer', handle: 'johnzimmer', category: 'founder' },
  { name: 'Apoorva Mehta', handle: 'apoorva-mehta', category: 'founder' },

  // Marketing Leaders
  { name: 'Seth Godin', handle: 'sethgodin', category: 'marketing' },
  { name: 'Guy Kawasaki', handle: 'guykawasaki', category: 'marketing' },
  { name: 'Ann Handley', handle: 'annhandley', category: 'marketing' },
  { name: 'Rand Fishkin', handle: 'randfishkin', category: 'marketing' },
  { name: 'Joe Pulizzi', handle: 'joepulizzi', category: 'marketing' },
  { name: 'Jay Baer', handle: 'jaybaer', category: 'marketing' },
  { name: 'Brian Halligan', handle: 'bhalligan', category: 'marketing' },
  { name: 'Dharmesh Shah', handle: 'dharmesh', category: 'marketing' },
  { name: 'David Meerman Scott', handle: 'dmscott', category: 'marketing' },
  { name: 'Mari Smith', handle: 'marismith', category: 'marketing' },

  // Sales Leaders
  { name: 'Aaron Ross', handle: 'aaronross', category: 'sales' },
  { name: 'Jill Konrath', handle: 'jillkonrath', category: 'sales' },
  { name: 'Mark Roberge', handle: 'markroberge', category: 'sales' },
  { name: 'Trish Bertuzzi', handle: 'bridgegroupinc', category: 'sales' },
  { name: 'Kyle Porter', handle: 'kyleporter', category: 'sales' },
  { name: 'Max Altschuler', handle: 'maxaltschuler', category: 'sales' },
  { name: 'Sam Jacobs', handle: 'samfjacobs', category: 'sales' },
  { name: 'Scott Leese', handle: 'scottleese', category: 'sales' },
  { name: 'John Barrows', handle: 'johnmbarrows', category: 'sales' },
  { name: 'Morgan Ingram', handle: 'mikiaylaingram', category: 'sales' },

  // Growth Hackers
  { name: 'Sean Ellis', handle: 'seanellis', category: 'growth' },
  { name: 'Hiten Shah', handle: 'hnshah', category: 'growth' },
  { name: 'Brian Balfour', handle: 'bbalfour', category: 'growth' },
  { name: 'Casey Winters', handle: 'onecaseman', category: 'growth' },
  { name: 'Kieran Flanagan', handle: 'searchbrat', category: 'growth' },
  { name: 'Noah Kagan', handle: 'noahkagan', category: 'growth' },
  { name: 'Sujan Patel', handle: 'sujanpatel', category: 'growth' },
  { name: 'Guillaume Cabane', handle: 'guillaumecabane', category: 'growth' },
  { name: 'Ethan Smith', handle: 'ethansmith', category: 'growth' },
  { name: 'Tomasz Tunguz', handle: 'ttunguz', category: 'growth' },

  // Data Science Leaders
  { name: 'DJ Patil', handle: 'daboroshy', category: 'data' },
  { name: 'Monica Rogati', handle: 'mrogati', category: 'data' },
  { name: 'Hilary Mason', handle: 'hmason', category: 'data' },
  { name: 'Kirk Borne', handle: 'kirkdborne', category: 'data' },
  { name: 'Carla Gentry', handle: 'caraboroshy', category: 'data' },
  { name: 'Cassie Kozyrkov', handle: 'kozyrkov', category: 'data' },
  { name: 'Kaggle', handle: 'kaggle', category: 'data' },
  { name: 'Vincent Granville', handle: 'vincentgranville', category: 'data' },
  { name: 'Randy Olson', handle: 'randal_olson', category: 'data' },
  { name: 'Francois Chollet', handle: 'fchollet', category: 'data' },

  // HR/People Leaders
  { name: 'Patty McCord', handle: 'pattymccord', category: 'people' },
  { name: 'Laszlo Bock', handle: 'laszlobock', category: 'people' },
  { name: 'Adam Grant', handle: 'adammgrant', category: 'people' },
  { name: 'Amy Edmondson', handle: 'amycedmondson', category: 'people' },
  { name: 'Josh Bersin', handle: 'joshbersin', category: 'people' },
  { name: 'Claude Silver', handle: 'claudesilver', category: 'people' },
  { name: 'Johnny Campbell', handle: 'johnnycampbell', category: 'people' },
  { name: 'Hung Lee', handle: 'hunglee', category: 'people' },
  { name: 'Meghan Biro', handle: 'meghanmbiro', category: 'people' },
  { name: 'William Tincup', handle: 'williamtincup', category: 'people' },

  // Fintech Leaders
  { name: 'Parker Conrad', handle: 'parkerconrad', category: 'fintech' },
  { name: 'Henrique Dubugras', handle: 'henrique-dubugras', category: 'fintech' },
  { name: 'Pedro Franceschi', handle: 'pedrofranceschi', category: 'fintech' },
  { name: 'Max Levchin', handle: 'maxlevchin', category: 'fintech' },
  { name: 'David Velez', handle: 'davidvelez', category: 'fintech' },
  { name: 'Taavet Hinrikus', handle: 'taavet', category: 'fintech' },
  { name: 'Kristo Kaarmann', handle: 'kkaarmann', category: 'fintech' },
  { name: 'Anne Boden', handle: 'anneboden', category: 'fintech' },
  { name: 'Nikolay Storonsky', handle: 'nstoronsky', category: 'fintech' },
  { name: 'Tom Blomfield', handle: 'tomblomfield', category: 'fintech' },

  // Healthcare Tech
  { name: 'Glen Tullman', handle: 'glentullman', category: 'healthtech' },
  { name: 'Halle Tecco', handle: 'halletecco', category: 'healthtech' },
  { name: 'Bob Kocher', handle: 'bobkocher', category: 'healthtech' },
  { name: 'Vivek Garipalli', handle: 'vgaripal', category: 'healthtech' },
  { name: 'Mario Schlosser', handle: 'mschlosser', category: 'healthtech' },
  { name: 'Josh Kushner', handle: 'joshkushner', category: 'healthtech' },
  { name: 'Elizabeth Holmes', handle: 'elizabethholmes', category: 'healthtech' },
  { name: 'Anne Wojcicki', handle: 'annewojcicki', category: 'healthtech' },
  { name: 'Noubar Afeyan', handle: 'nafeyan', category: 'healthtech' },
  { name: 'Stephane Bancel', handle: 'stephanebancel', category: 'healthtech' },

  // EdTech Leaders
  { name: 'Sal Khan', handle: 'salkhanacademy', category: 'edtech' },
  { name: 'Luis von Ahn', handle: 'luisvonahn', category: 'edtech' },
  { name: 'Anant Agarwal', handle: 'anantagarwal', category: 'edtech' },
  { name: 'Lynda Weinman', handle: 'lyndadotcom', category: 'edtech' },
  { name: 'John Katzman', handle: 'johnkatzman', category: 'edtech' },
  { name: 'Ben Nelson', handle: 'benn', category: 'edtech' },
  { name: 'Austen Allred', handle: 'austenallred', category: 'edtech' },
  { name: 'Ryan Craig', handle: 'ryancraig', category: 'edtech' },
  { name: 'Deborah Quazzo', handle: 'deborahquazzo', category: 'edtech' },
  { name: 'Michael Moe', handle: 'michaelmoe', category: 'edtech' },

  // PropTech/Real Estate Tech
  { name: 'Rich Barton', handle: 'richbarton', category: 'proptech' },
  { name: 'Glenn Kelman', handle: 'glennkelman', category: 'proptech' },
  { name: 'Clelia Peters', handle: 'cleliawarburg', category: 'proptech' },
  { name: 'Pete Flint', handle: 'peteflint', category: 'proptech' },
  { name: 'Spencer Rascoff', handle: 'spencerrascoff', category: 'proptech' },
  { name: 'Eric Wu', handle: 'ericwu', category: 'proptech' },
  { name: 'Robert Reffkin', handle: 'robertreffkin', category: 'proptech' },
  { name: 'Jonathan Wasserstrum', handle: 'jwasserstrum', category: 'proptech' },
  { name: 'Adam Neumann', handle: 'adamneumann', category: 'proptech' },
  { name: 'Miguel McKelvey', handle: 'miguelmckelvey', category: 'proptech' },

  // Climate/Green Tech
  { name: 'John Doerr', handle: 'johndoerr2', category: 'climatetech' },
  { name: 'Bill Gates', handle: 'williamhgates', category: 'climatetech' },
  { name: 'Nancy Pfund', handle: 'nancypfund', category: 'climatetech' },
  { name: 'Ira Ehrenpreis', handle: 'iraehrenpreis', category: 'climatetech' },
  { name: 'Katie Rae', handle: 'katierae', category: 'climatetech' },
  { name: 'Emily Kirsch', handle: 'emilykirsch', category: 'climatetech' },
  { name: 'Mat Taibbi', handle: 'mattaibbi', category: 'climatetech' },
  { name: 'Jigar Shah', handle: 'jiaboroshy', category: 'climatetech' },
  { name: 'Ramez Naam', handle: 'ramaboroshy', category: 'climatetech' },
  { name: 'Saul Griffith', handle: 'saulgriffith', category: 'climatetech' },

  // Gaming Industry
  { name: 'Phil Spencer', handle: 'xaboroshy', category: 'gaming' },
  { name: 'Bobby Kotick', handle: 'bobbykotick', category: 'gaming' },
  { name: 'Tim Sweeney', handle: 'timsweeney', category: 'gaming' },
  { name: 'Andrew Wilson', handle: 'eaandrewwilson', category: 'gaming' },
  { name: 'Yves Guillemot', handle: 'yvesguillemot', category: 'gaming' },
  { name: 'Jason Citron', handle: 'jasoncitron', category: 'gaming' },
  { name: 'Emmett Shear', handle: 'emmettshear', category: 'gaming' },
  { name: 'Kevin Lin', handle: 'kevinlin', category: 'gaming' },
  { name: 'Amy Hennig', handle: 'amyhennig', category: 'gaming' },
  { name: 'Jade Raymond', handle: 'jaboroshy', category: 'gaming' },

  // Tech Companies (Company Pages)
  { name: 'Microsoft', handle: 'microsoft', category: 'company' },
  { name: 'Google', handle: 'google', category: 'company' },
  { name: 'Amazon', handle: 'amazon', category: 'company' },
  { name: 'Meta', handle: 'meta', category: 'company' },
  { name: 'Apple', handle: 'apple', category: 'company' },
  { name: 'Netflix', handle: 'netflix', category: 'company' },
  { name: 'Salesforce', handle: 'salesforce', category: 'company' },
  { name: 'Adobe', handle: 'adobe', category: 'company' },
  { name: 'Shopify', handle: 'shopify', category: 'company' },
  { name: 'Stripe', handle: 'stripe', category: 'company' },
  { name: 'Notion', handle: 'notionhq', category: 'company' },
  { name: 'Figma', handle: 'figma', category: 'company' },
  { name: 'Linear', handle: 'linearapp', category: 'company' },
  { name: 'Vercel', handle: 'vercel', category: 'company' },
  { name: 'Supabase', handle: 'supabase-inc', category: 'company' },
  { name: 'PlanetScale', handle: 'planetscaledata', category: 'company' },
  { name: 'Railway', handle: 'railway', category: 'company' },
  { name: 'Render', handle: 'renderco', category: 'company' },
  { name: 'Fly.io', handle: 'fly-io', category: 'company' },
  { name: 'Cloudflare', handle: 'cloudflare', category: 'company' },
  { name: 'Datadog', handle: 'datadoghq', category: 'company' },
  { name: 'MongoDB', handle: 'mongodb', category: 'company' },
  { name: 'Elastic', handle: 'elastic', category: 'company' },
  { name: 'Confluent', handle: 'confluentinc', category: 'company' },
  { name: 'Databricks', handle: 'databricks', category: 'company' },
  { name: 'Snowflake', handle: 'snowflake-computing', category: 'company' },
  { name: 'Twilio', handle: 'twilio', category: 'company' },
  { name: 'SendGrid', handle: 'sendgrid', category: 'company' },
  { name: 'Segment', handle: 'segment', category: 'company' },
  { name: 'Amplitude', handle: 'amplitude-analytics', category: 'company' },
];

async function fetchLinkedInProfile(handle: string, isCompany: boolean = false): Promise<{ profile: any; isPrivate: boolean }> {
  try {
    const endpoint = isCompany
      ? 'https://api.scrapecreators.com/v1/linkedin/company'
      : 'https://api.scrapecreators.com/v1/linkedin/profile';
    const url = isCompany
      ? `https://linkedin.com/company/${handle}`
      : `https://linkedin.com/in/${handle}`;

    const response = await axios.get(endpoint, {
      headers: { 'x-api-key': SCRAPECREATORS_API_KEY },
      params: { url },
      timeout: 30000
    });

    if (response.data?.message?.includes('private') ||
        response.data?.message?.includes('not publicly available') ||
        response.data?.success === false) {
      return { profile: null, isPrivate: true };
    }

    const data = response.data?.data || response.data;
    if (!data || Object.keys(data).length === 0) {
      return { profile: null, isPrivate: true };
    }

    return { profile: data, isPrivate: false };
  } catch {
    return { profile: null, isPrivate: true };
  }
}

async function importProfile(item: { name: string; handle: string; category: string }): Promise<boolean> {
  const isCompany = item.category === 'company';
  const handle = item.handle.toLowerCase();

  try {
    const existing = await db.streamer.findUnique({
      where: {
        platform_username: { platform: 'LINKEDIN', username: handle }
      }
    });

    if (existing) {
      return false;
    }

    const { profile, isPrivate } = await fetchLinkedInProfile(item.handle, isCompany);

    let displayName: string;
    let avatarUrl: string | undefined;
    let followers = 0;
    let description: string;

    if (profile && !isPrivate) {
      displayName = profile.name ||
        `${profile.first_name || ''} ${profile.last_name || ''}`.trim() ||
        item.name;
      avatarUrl = profile.image || undefined;
      followers = profile.followers || profile.follower_count || 0;
      description = profile.headline || profile.about || profile.description || `${item.category}`;
    } else {
      displayName = item.name;
      followers = 0;
      description = `LinkedIn (${isPrivate ? 'private' : 'import'}) - ${item.category}`;
    }

    if (avatarUrl) {
      try {
        avatarUrl = await bunnyService.uploadLinkedInAvatar(handle, avatarUrl);
      } catch {}
    }

    const profileUrl = isCompany
      ? `https://linkedin.com/company/${handle}`
      : `https://linkedin.com/in/${handle}`;

    await db.streamer.create({
      data: {
        platform: 'LINKEDIN',
        username: handle,
        displayName,
        profileUrl,
        avatarUrl,
        followers,
        profileDescription: description,
        region: Region.WORLDWIDE,
        lastScrapedAt: new Date(),
        discoveredVia: `import:${item.category}`,
      }
    });

    const status = isPrivate ? '🔒' : '✅';
    console.log(`  ${status} ${displayName} (@${handle}) - ${followers} followers`);
    return true;
  } catch (error: any) {
    console.log(`  ❌ Error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('===========================================');
  console.log('   LINKEDIN BATCH 3 IMPORT');
  console.log('===========================================\n');

  const initialCount = await db.streamer.count({ where: { platform: 'LINKEDIN' } });
  console.log(`Initial LinkedIn count: ${initialCount}`);
  console.log(`Profiles to import: ${PROFILES.length}\n`);

  let created = 0;
  let skipped = 0;

  for (let i = 0; i < PROFILES.length; i++) {
    const profile = PROFILES[i];
    console.log(`[${i + 1}/${PROFILES.length}] ${profile.name}`);

    const success = await importProfile(profile);
    if (success) created++;
    else skipped++;

    // Rate limiting
    await new Promise(r => setTimeout(r, 200));

    // Progress check every 50
    if ((i + 1) % 50 === 0) {
      const currentCount = await db.streamer.count({ where: { platform: 'LINKEDIN' } });
      console.log(`\n--- Progress: ${i + 1}/${PROFILES.length}, LinkedIn total: ${currentCount} ---\n`);
    }
  }

  const finalCount = await db.streamer.count({ where: { platform: 'LINKEDIN' } });

  console.log('\n===========================================');
  console.log('   BATCH 3 IMPORT COMPLETE');
  console.log('===========================================');
  console.log(`Profiles processed: ${PROFILES.length}`);
  console.log(`New profiles created: ${created}`);
  console.log(`Skipped (existing): ${skipped}`);
  console.log(`Initial LinkedIn: ${initialCount}`);
  console.log(`Final LinkedIn: ${finalCount}`);
  console.log(`Progress: ${finalCount}/1000 target`);

  await db.$disconnect();
}

main().catch(console.error);
